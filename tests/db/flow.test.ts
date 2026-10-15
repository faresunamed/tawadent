import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db, PROFILE } from "./helpers";

let db: Db;
let adminId: string;
let dentistId: string;
let patientA: string;
let patientB: string;

let seq = 100;
const SAVE_PROFILE = `select public.save_dentist_profile($1,$2,$3,$4,$5,$6,$7,$8) as s`;

async function approvedAvailableDentist(email = "dentist@test.tn", zone = "lac-1") {
  const id = await db.newUser(email, "dentist");
  const p = [...PROFILE.full];
  p[3] = zone;
  p[7] = `ORDRE-${++seq}`;
  await db.as(id, () => db.call(SAVE_PROFILE, p));
  await db.as(adminId, () => db.call(`select public.admin_set_dentist_status($1, 'approved', null)`, [id]));
  await db.as(id, () => db.call(`select public.set_availability(true)`));
  return id;
}

async function expectError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toThrow(code);
}

beforeEach(async () => {
  db = await createDb();
  adminId = await db.newUser("admin@test.tn");
  await db.admin(`update public.profiles set role = 'admin' where id = $1`, [adminId]);
  patientA = await db.newUser("a@test.tn", "patient");
  patientB = await db.newUser("b@test.tn", "patient");
  dentistId = await approvedAvailableDentist();
});

describe("comptes et rôles", () => {
  it("attribue le rôle depuis les métadonnées, sans jamais donner admin", async () => {
    const sneaky = await db.newUser("sneaky@test.tn", "admin");
    const rows = await db.admin(`select role from public.profiles where id = $1`, [sneaky]);
    expect(rows[0].role).toBe("patient");
    const d = await db.admin(`select role from public.profiles where id = $1`, [dentistId]);
    expect(d[0].role).toBe("dentist");
  });

  it("un nouveau dentiste est en attente et ne peut pas se déclarer disponible", async () => {
    const id = await db.newUser("new@test.tn", "dentist");
    const r = await db.as(id, () => db.call(SAVE_PROFILE, PROFILE.full));
    expect(r[0].s).toBe("pending");
    await expectError(db.as(id, () => db.call(`select public.set_availability(true)`)), "dentist_not_approved");
    const list = await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`));
    expect(list.map((c) => c.id)).not.toContain(id);
  });

  it("un patient ne peut pas créer de profil dentiste", async () => {
    await expectError(db.as(patientA, () => db.call(SAVE_PROFILE, PROFILE.full)), "not_a_dentist");
  });

  it("changer le numéro d'Ordre remet le profil en validation et coupe la disponibilité", async () => {
    const p = [...PROFILE.full];
    p[7] = "AUTRE-NUMERO";
    const r = await db.as(dentistId, () => db.call(SAVE_PROFILE, p));
    expect(r[0].s).toBe("pending");
    const row = await db.admin(`select available_until from public.dentists where id = $1`, [dentistId]);
    expect(row[0].available_until).toBeNull();
  });
});

describe("liste des cabinets", () => {
  it("n'affiche que les cabinets validés, disponibles, dans la zone choisie", async () => {
    const lac = await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`));
    expect(lac.map((c) => c.id)).toEqual([dentistId]);
    const other = await db.asAnon(() => db.call(`select * from public.list_available_clinics('la-marsa')`));
    expect(other).toHaveLength(0);
  });

  it("n'expose ni téléphone ni adresse avant acceptation", async () => {
    const lac = await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`));
    expect(Object.keys(lac[0]).sort()).toEqual(
      ["available_until", "clinic_name", "dentist_name", "id", "zone_id"].sort()
    );
  });

  it("une disponibilité de 60 minutes se termine d'elle-même", async () => {
    await db.admin(`update public.dentists set available_until = now() - interval '1 second' where id = $1`, [dentistId]);
    const lac = await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`));
    expect(lac).toHaveLength(0);
  });
});

describe("demande d'urgence (60 s)", () => {
  it("crée une demande en attente de 60 secondes et masque le cabinet des autres patients", async () => {
    const r = await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', '+216 22 111 222') as id`, [dentistId]));
    const req = await db.as(patientA, () => db.call(`select public.get_request($1) as j`, [r[0].id]));
    expect(req[0].j.status).toBe("pending");
    expect(req[0].j.seconds_left).toBeGreaterThan(55);
    expect(req[0].j.seconds_left).toBeLessThanOrEqual(60);
    expect(req[0].j.clinic).toBeUndefined(); // coordonnées masquées
    const list = await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`));
    expect(list).toHaveLength(0);
  });

  it("refuse une deuxième demande sur le même cabinet (un patient à la fois)", async () => {
    await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null)`, [dentistId]));
    await expectError(
      db.as(patientB, () => db.call(`select public.create_request($1, 'Lina', null)`, [dentistId])),
      "clinic_busy"
    );
  });

  it("refuse une deuxième demande active pour le même patient", async () => {
    const d2 = await approvedAvailableDentist("d2@test.tn");
    await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null)`, [dentistId]));
    await expectError(
      db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null)`, [d2])),
      "patient_has_active_request"
    );
  });

  it("limite à 5 demandes par heure", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null) as id`, [dentistId]));
      await db.as(patientA, () => db.call(`select public.cancel_request($1)`, [r[0].id]));
    }
    await expectError(
      db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null)`, [dentistId])),
      "rate_limited"
    );
  });

  it("valide les champs saisis", async () => {
    await expectError(
      db.as(patientA, () => db.call(`select public.create_request($1, '   ', null)`, [dentistId])),
      "invalid_input"
    );
    await expectError(
      db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', 'abc; drop table')`, [dentistId])),
      "invalid_input"
    );
  });

  it("l'acceptation révèle les coordonnées au patient et consomme la disponibilité", async () => {
    const r = await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null) as id`, [dentistId]));
    const res = await db.as(dentistId, () => db.call(`select public.respond_request($1, true) as s`, [r[0].id]));
    expect(res[0].s).toBe("accepted");

    const req = await db.as(patientA, () => db.call(`select public.get_request($1) as j`, [r[0].id]));
    expect(req[0].j.status).toBe("accepted");
    expect(req[0].j.clinic.phone).toBe("+21620000000");
    expect(req[0].j.clinic.address).toContain("Lac");

    // Réservé : invisible, et impossible de se redéclarer tant que la consultation n'est pas terminée.
    const list = await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`));
    expect(list).toHaveLength(0);
    await db.as(patientA, () => db.call(`select public.mark_arrived($1)`, [r[0].id]));
    await db.as(dentistId, () => db.call(`select public.complete_request($1)`, [r[0].id]));

    // Disponibilité consommée : il faut se redéclarer.
    const dent = await db.admin(`select available_until from public.dentists where id = $1`, [dentistId]);
    expect(dent[0].available_until).toBeNull();
    await db.as(dentistId, () => db.call(`select public.set_availability(true)`));
    const again = await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`));
    expect(again).toHaveLength(1);
  });

  it("un refus garde la disponibilité du cabinet", async () => {
    const r = await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null) as id`, [dentistId]));
    const res = await db.as(dentistId, () => db.call(`select public.respond_request($1, false) as s`, [r[0].id]));
    expect(res[0].s).toBe("declined");
    const list = await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`));
    expect(list).toHaveLength(1);
  });

  it("expire après 60 s : le patient peut choisir un autre cabinet, le cabinet reste disponible", async () => {
    const r = await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null) as id`, [dentistId]));
    await db.admin(`update public.requests set expires_at = now() - interval '1 second' where id = $1`, [r[0].id]);

    const req = await db.as(patientA, () => db.call(`select public.get_request($1) as j`, [r[0].id]));
    expect(req[0].j.status).toBe("expired");
    const dent = await db.admin(`select available_until from public.dentists where id = $1`, [dentistId]);
    expect(dent[0].available_until).not.toBeNull(); // la disponibilité reste
    const still = await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`));
    expect(still.map((c) => c.id)).toContain(dentistId);

    // Le patient peut immédiatement demander à un autre cabinet.
    const d2 = await approvedAvailableDentist("d2@test.tn");
    const r2 = await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null) as id`, [d2]));
    expect(r2[0].id).toBeTruthy();
  });

  it("répondre trop tard n'accepte pas la demande", async () => {
    const r = await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null) as id`, [dentistId]));
    await db.admin(`update public.requests set expires_at = now() - interval '1 second' where id = $1`, [r[0].id]);
    const res = await db.as(dentistId, () => db.call(`select public.respond_request($1, true) as s`, [r[0].id]));
    expect(res[0].s).toBe("expired");
  });

  it("le patient peut annuler, et retrouver sa demande après rechargement", async () => {
    const r = await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null) as id`, [dentistId]));
    const latest = await db.as(patientA, () => db.call(`select public.get_my_latest_request() as j`));
    expect(latest[0].j.id).toBe(r[0].id);
    const c = await db.as(patientA, () => db.call(`select public.cancel_request($1) as s`, [r[0].id]));
    expect(c[0].s).toBe("cancelled");
    const none = await db.as(patientA, () => db.call(`select public.get_my_latest_request() as j`));
    expect(none[0].j).toBeNull();
  });

  it("le dentiste voit ses demandes avec un compte à rebours serveur", async () => {
    await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', '+216 22 111 222')`, [dentistId]));
    const inbox = await db.as(dentistId, () => db.call(`select * from public.dentist_requests()`));
    expect(inbox).toHaveLength(1);
    expect(inbox[0].status).toBe("pending");
    expect(inbox[0].patient_first_name).toBe("Sami");
    expect(inbox[0].seconds_left).toBeGreaterThan(55);
    await db.admin(`update public.requests set expires_at = now() - interval '1 second'`);
    const after = await db.as(dentistId, () => db.call(`select * from public.dentist_requests()`));
    expect(after[0].status).toBe("expired");
    expect(after[0].seconds_left).toBe(0);
  });

  it("l'admin ne peut pas suspendre un cabinet ayant une demande active", async () => {
    const r = await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null) as id`, [dentistId]));
    await expectError(
      db.as(adminId, () => db.call(`select public.admin_set_dentist_status($1, 'suspended', 'test')`, [dentistId])),
      "busy"
    );
    await db.as(dentistId, () => db.call(`select public.respond_request($1, false)`, [r[0].id]));
    await db.as(adminId, () => db.call(`select public.admin_set_dentist_status($1, 'suspended', 'test')`, [dentistId]));
    await expectError(
      db.as(dentistId, () => db.call(`select public.set_availability(true)`)),
      "dentist_not_approved"
    );
  });
});

describe("sécurité", () => {
  it("un visiteur non connecté ne peut pas envoyer de demande", async () => {
    await expect(
      db.asAnon(() => db.call(`select public.create_request($1, 'Sami', null)`, [dentistId]))
    ).rejects.toThrow(/permission denied/);
  });

  it("un dentiste ne peut pas envoyer de demande de patient", async () => {
    await expectError(
      db.as(dentistId, () => db.call(`select public.create_request($1, 'Sami', null)`, [dentistId])),
      "not_a_patient"
    );
  });

  it("aucune écriture directe sur les tables", async () => {
    await expect(
      db.as(dentistId, () => db.call(`update public.dentists set status = 'approved' where id = $1`, [dentistId]))
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(patientA, () => db.call(`update public.profiles set role = 'admin' where id = $1`, [patientA]))
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(patientA, () =>
        db.call(
          `insert into public.requests (patient_id, dentist_id, zone_id, patient_first_name, expires_at)
           values ($1, $2, 'lac-1', 'x', now() + interval '1 hour')`,
          [patientA, dentistId]
        )
      )
    ).rejects.toThrow(/permission denied/);
  });

  it("un patient ne voit pas les demandes des autres", async () => {
    await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null)`, [dentistId]));
    const seenByB = await db.as(patientB, () => db.call(`select * from public.requests`));
    expect(seenByB).toHaveLength(0);
    const seenByA = await db.as(patientA, () => db.call(`select * from public.requests`));
    expect(seenByA).toHaveLength(1);
  });

  it("un patient ne peut pas lire la demande d'un autre patient", async () => {
    const r = await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null) as id`, [dentistId]));
    await expectError(db.as(patientB, () => db.call(`select public.get_request($1)`, [r[0].id])), "request_not_found");
  });

  it("un dentiste ne répond qu'à ses propres demandes", async () => {
    const d2 = await approvedAvailableDentist("d2@test.tn");
    const r = await db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null) as id`, [dentistId]));
    await expectError(db.as(d2, () => db.call(`select public.respond_request($1, true)`, [r[0].id])), "request_not_found");
  });

  it("les fonctions admin sont réservées à l'admin", async () => {
    await expectError(db.as(patientA, () => db.call(`select * from public.admin_list_dentists(null)`)), "not_admin");
    await expectError(db.as(dentistId, () => db.call(`select public.admin_overview()`)), "not_admin");
    await expectError(
      db.as(dentistId, () => db.call(`select public.admin_set_dentist_status($1, 'approved', null)`, [dentistId])),
      "not_admin"
    );
  });

  it("les fonctions internes ne sont pas appelables par les clients", async () => {
    await expect(db.as(patientA, () => db.call(`select public.expire_stale_requests()`))).rejects.toThrow(/permission denied/);
    await expect(db.as(patientA, () => db.call(`select public._require_admin()`))).rejects.toThrow(/permission denied/);
  });
});

describe("espace admin", () => {
  it("liste, valide, suspend et supervise", async () => {
    const pendingId = await db.newUser("p@test.tn", "dentist");
    const pp = [...PROFILE.full]; pp[7] = "ORDRE-PEND";
    await db.as(pendingId, () => db.call(SAVE_PROFILE, pp));

    const pending = await db.as(adminId, () => db.call(`select * from public.admin_list_dentists('pending')`));
    expect(pending.map((d) => d.id)).toEqual([pendingId]);
    expect(pending[0].email).toBe("p@test.tn");

    await db.as(adminId, () => db.call(`select public.admin_set_dentist_status($1, 'suspended', 'doublon')`, [dentistId]));
    const list = await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`));
    expect(list).toHaveLength(0);

    const overview = await db.as(adminId, () => db.call(`select public.admin_overview() as o`));
    expect(overview[0].o.dentists.suspended).toBe(1);
    expect(overview[0].o.dentists.pending).toBe(1);

    const actions = await db.as(adminId, () => db.call(`select action, note from public.admin_actions order by id`));
    expect(actions).toEqual([
      { action: "approved", note: null },
      { action: "suspended", note: "doublon" },
    ]);

    const recent = await db.as(adminId, () => db.call(`select * from public.admin_recent_requests()`));
    expect(Array.isArray(recent)).toBe(true);
  });
});

describe("règles issues de l'application Flutter", () => {
  const mk = (id: string) => db.as(patientA, () => db.call(`select public.create_request($1, 'Sami', null) as id`, [id]));
  const accept = async (rid: string) =>
    db.as(dentistId, () => db.call(`select public.respond_request($1, true) as s`, [rid]));

  it("un numéro d'Ordre ne peut servir qu'une fois", async () => {
    const other = await db.newUser("o@test.tn", "dentist");
    const used = await db.admin(`select order_number from public.dentists where id=$1`, [dentistId]);
    const p = [...PROFILE.full]; p[7] = ` ${used[0].order_number.toLowerCase()} `;
    await expectError(db.as(other, () => db.call(SAVE_PROFILE, p)), "registration_used");
  });

  it("le téléphone doit être tunisien (8 chiffres)", async () => {
    const other = await db.newUser("o2@test.tn", "dentist");
    const p = [...PROFILE.full]; p[4] = "123"; p[7] = "ORDRE-X";
    await expectError(db.as(other, () => db.call(SAVE_PROFILE, p)), "invalid_input");
  });

  it("parcours complet : demande, confirmation, arrivée, consultation terminée", async () => {
    const r = await mk(dentistId);
    await accept(r[0].id);
    // le cabinet réservé disparaît de la liste
    expect(await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`))).toHaveLength(0);
    const a = await db.as(patientA, () => db.call(`select public.mark_arrived($1) as s`, [r[0].id]));
    expect(a[0].s).toBe("arrived");
    expect(await db.asAnon(() => db.call(`select * from public.list_available_clinics('lac-1')`))).toHaveLength(0);
    await expectError(db.as(dentistId, () => db.call(`select public.set_availability(false)`)), "busy");
    const c = await db.as(dentistId, () => db.call(`select public.complete_request($1) as s`, [r[0].id]));
    expect(c[0].s).toBe("completed");
    // consommée : le cabinet doit se redéclarer
    const d = await db.admin(`select available_until from public.dentists where id=$1`, [dentistId]);
    expect(d[0].available_until).toBeNull();
    const hist = await db.as(patientA, () => db.call(`select * from public.list_my_requests()`));
    expect(hist).toHaveLength(1);
    // le patient peut refaire une demande
    await db.as(dentistId, () => db.call(`select public.set_availability(true)`));
    expect((await mk(dentistId))[0].id).toBeTruthy();
  });

  it("transitions interdites", async () => {
    const r = await mk(dentistId);
    await expectError(db.as(patientA, () => db.call(`select public.mark_arrived($1)`, [r[0].id])), "invalid_transition");
    await expectError(db.as(dentistId, () => db.call(`select public.complete_request($1)`, [r[0].id])), "invalid_transition");
  });

  it("le patient peut annuler une demande confirmée", async () => {
    const r = await mk(dentistId);
    await accept(r[0].id);
    const c = await db.as(patientA, () => db.call(`select public.cancel_request($1) as s`, [r[0].id]));
    expect(c[0].s).toBe("cancelled");
  });

  it("le dentiste peut libérer la place d'un patient non venu", async () => {
    const r = await mk(dentistId);
    await accept(r[0].id);
    const x = await db.as(dentistId, () => db.call(`select public.release_request($1) as s`, [r[0].id]));
    expect(x[0].s).toBe("cancelled");
  });

  it("modifier son profil pendant une demande active est refusé", async () => {
    await mk(dentistId);
    const p = [...PROFILE.full]; p[1] = "Autre nom";
    await expectError(db.as(dentistId, () => db.call(SAVE_PROFILE, p)), "busy");
  });

  it("le journal d'activité est réservé à l'admin et trace les événements", async () => {
    const r = await mk(dentistId);
    await accept(r[0].id);
    await expectError(db.as(patientA, () => db.call(`select * from public.admin_audit()`)), "not_admin");
    const log = await db.as(adminId, () => db.call(`select * from public.admin_audit()`));
    const actions = log.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["requested", "confirmed"]));
    const ov = await db.as(adminId, () => db.call(`select public.admin_overview() as o`));
    expect(ov[0].o.active_requests).toBe(1);
  });
});

describe("inscription sans validation d'email", () => {
  it("tout nouveau compte est confirmé automatiquement", async () => {
    const id = await db.newUser("nouveau@test.tn", "patient");
    const r = await db.admin(`select email_confirmed_at is not null as ok from auth.users where id = $1`, [id]);
    expect(r[0].ok).toBe(true);
  });
});
