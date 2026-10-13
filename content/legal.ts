import type { Locale } from "@/lib/i18n";

export type LegalDoc = {
  title: string;
  draft: string;
  sections: { h: string; p: string[] }[];
};

export type LegalKey = "privacy" | "terms";

export const LEGAL_KEYS: LegalKey[] = ["privacy", "terms"];

/**
 * BROUILLONS à faire relire par un juriste tunisien avant le lancement.
 * Les passages entre [crochets] sont à compléter.
 */
export const LEGAL: Record<LegalKey, Record<Locale, LegalDoc>> = {
  privacy: {
    fr: {
      title: "Politique de confidentialité",
      draft:
        "Projet de texte, à faire valider par un juriste avant publication. Les passages entre [crochets] sont à compléter.",
      sections: [
        {
          h: "1. Qui sommes-nous ?",
          p: [
            "TawaDent est une plateforme de mise en relation entre des patients ayant une urgence dentaire et des cabinets dentaires privés du Grand Tunis.",
            "Responsable du traitement : [raison sociale, adresse, email de contact].",
          ],
        },
        {
          h: "2. Données collectées",
          p: [
            "Patients : adresse email (pour la connexion), prénom, numéro de téléphone (facultatif), zone choisie, cabinet sollicité, date, heure et issue de la demande.",
            "TawaDent ne demande aucun motif médical, ne pose aucun diagnostic et n'utilise pas la géolocalisation GPS du patient : le patient choisit seulement sa zone.",
            "Dentistes : nom, nom et adresse du cabinet, téléphone, email, numéro d'inscription à l'Ordre, coordonnées GPS du cabinet (facultatif) et état de disponibilité.",
          ],
        },
        {
          h: "3. Pourquoi ces données ?",
          p: [
            "Mettre en relation un patient et un cabinet, vérifier les professionnels, prévenir les abus (limitation du nombre de demandes) et suivre l'activité du service.",
            "Nous ne vendons pas vos données et ne les utilisons pas à des fins publicitaires.",
          ],
        },
        {
          h: "4. Qui reçoit vos données ?",
          p: [
            "Le cabinet que vous sollicitez reçoit votre prénom et, si vous l'avez renseigné, votre téléphone. Après acceptation, vous accédez à l'adresse et au téléphone du cabinet.",
            "L'équipe d'administration de TawaDent y a accès pour valider les profils et superviser le service.",
            "Nos prestataires techniques hébergent le service : Supabase (base de données et authentification) et Vercel (application). [Vérifier avec un juriste les obligations liées au transfert de données hors de Tunisie.]",
          ],
        },
        {
          h: "5. Durée de conservation",
          p: [
            "[Proposition : demandes conservées 12 mois puis supprimées ou anonymisées ; comptes conservés tant qu'ils sont actifs, puis supprimés sur demande.]",
          ],
        },
        {
          h: "6. Vos droits",
          p: [
            "Vous pouvez demander l'accès, la rectification, l'opposition ou la suppression de vos données en écrivant à [email de contact].",
            "Le traitement des données personnelles en Tunisie relève de la loi organique n° 2004-63 du 27 juillet 2004 et de l'Instance nationale de protection des données personnelles (INPDP). [À confirmer et à déclarer avec un juriste.]",
          ],
        },
        {
          h: "7. Sécurité et stockage local",
          p: [
            "Les échanges sont chiffrés (HTTPS) et l'accès aux données est limité par rôle (patient, dentiste, administrateur).",
            "L'application enregistre dans votre navigateur uniquement les éléments nécessaires à votre connexion. Aucun cookie publicitaire n'est utilisé.",
          ],
        },
      ],
    },
    ar: {
      title: "سياسة الخصوصية",
      draft: "مشروع نص يجب أن يراجعه مختص قانوني قبل النشر. الفقرات بين [أقواس] تحتاج إلى استكمال.",
      sections: [
        {
          h: "1. من نحن؟",
          p: [
            "TawaDent منصة تربط المرضى الذين لديهم حالة طارئة في الأسنان بعيادات أسنان خاصة في تونس الكبرى.",
            "المسؤول عن المعالجة: [الاسم الاجتماعي، العنوان، البريد الإلكتروني للتواصل].",
          ],
        },
        {
          h: "2. المعطيات التي نجمعها",
          p: [
            "المرضى: عنوان البريد الإلكتروني (لتسجيل الدخول)، الاسم الأول، رقم الهاتف (اختياري)، المنطقة المختارة، العيادة المطلوبة، وتاريخ الطلب ووقته ونتيجته.",
            "لا تطلب TawaDent أي سبب طبي ولا تقدّم أي تشخيص ولا تستعمل تحديد الموقع الجغرافي للمريض: المريض يختار منطقته فقط.",
            "أطباء الأسنان: الاسم، اسم العيادة وعنوانها، الهاتف، البريد الإلكتروني، رقم التسجيل في العمادة، إحداثيات العيادة (اختياري) وحالة التوفر.",
          ],
        },
        {
          h: "3. لماذا نستعمل هذه المعطيات؟",
          p: [
            "للربط بين المريض والعيادة، والتحقق من المهنيين، ومنع التجاوزات (تحديد عدد الطلبات)، ومتابعة نشاط الخدمة.",
            "لا نبيع معطياتك ولا نستعملها لأغراض إشهارية.",
          ],
        },
        {
          h: "4. من يستلم معطياتك؟",
          p: [
            "تستلم العيادة التي تطلبها اسمك الأول ورقم هاتفك إن أدخلته. وبعد القبول، تطّلع على عنوان العيادة وهاتفها.",
            "يطّلع فريق إدارة TawaDent عليها للمصادقة على الملفات ومراقبة الخدمة.",
            "يستضيف مزودو خدمات تقنية الخدمة: Supabase (قاعدة البيانات والمصادقة) وVercel (التطبيق). [يجب التحقق مع مختص قانوني من الالتزامات المتعلقة بنقل المعطيات خارج تونس.]",
          ],
        },
        {
          h: "5. مدة الاحتفاظ",
          p: [
            "[اقتراح: الاحتفاظ بالطلبات 12 شهرًا ثم حذفها أو إخفاء هوية أصحابها؛ والاحتفاظ بالحسابات ما دامت نشطة، ثم حذفها عند الطلب.]",
          ],
        },
        {
          h: "6. حقوقك",
          p: [
            "يمكنك طلب الاطلاع على معطياتك أو تصحيحها أو الاعتراض على معالجتها أو حذفها بمراسلتنا على [البريد الإلكتروني للتواصل].",
            "تخضع حماية المعطيات الشخصية في تونس للقانون الأساسي عدد 63 لسنة 2004 المؤرخ في 27 جويلية 2004 وللهيئة الوطنية لحماية المعطيات الشخصية. [يجب التأكد من ذلك ومن إجراءات التصريح مع مختص قانوني.]",
          ],
        },
        {
          h: "7. الأمان والتخزين المحلي",
          p: [
            "التبادلات مشفّرة (HTTPS) ويقتصر الدخول إلى المعطيات حسب الصفة (مريض، طبيب أسنان، مسؤول).",
            "يحفظ التطبيق في متصفحك فقط ما يلزم لتسجيل الدخول. ولا نستعمل أي ملفات تعريف ارتباط إشهارية.",
          ],
        },
      ],
    },
  },
  terms: {
    fr: {
      title: "Conditions d'utilisation",
      draft:
        "Projet de texte, à faire valider par un juriste avant publication. Les passages entre [crochets] sont à compléter.",
      sections: [
        {
          h: "1. Objet",
          p: [
            "TawaDent met en relation des patients et des cabinets dentaires privés du Grand Tunis en cas d'urgence dentaire. TawaDent n'est pas un prestataire de soins.",
          ],
        },
        {
          h: "2. Aucun avis médical",
          p: [
            "L'application ne réalise aucun diagnostic et ne donne aucun conseil médical. En cas de danger vital, appelez immédiatement le 190 (SAMU).",
          ],
        },
        {
          h: "3. Fonctionnement",
          p: [
            "Le patient choisit sa zone, sélectionne librement un cabinet disponible et envoie une demande. Le cabinet dispose de 60 secondes pour confirmer. En cas d'acceptation, le patient accède aux coordonnées du cabinet et à l'itinéraire. Sans réponse, le patient peut choisir un autre cabinet.",
            "Un cabinet se déclare disponible pour 60 minutes. Une consultation confirmée, ou une demande restée sans réponse, met fin à cette disponibilité.",
          ],
        },
        {
          h: "4. Obligations du patient",
          p: [
            "Fournir des informations exactes, ne faire qu'une demande à la fois et ne pas détourner le service. Le nombre de demandes est limité pour éviter les abus.",
          ],
        },
        {
          h: "5. Obligations des dentistes",
          p: [
            "Être inscrit à l'Ordre, fournir un profil exact, déclarer sa disponibilité de bonne foi et répondre rapidement aux demandes. Un profil est validé manuellement avant d'être visible et peut être suspendu en cas de manquement.",
          ],
        },
        {
          h: "6. Responsabilité",
          p: [
            "La relation de soins, les honoraires et la qualité des actes relèvent uniquement du patient et du dentiste. TawaDent ne garantit pas la disponibilité effective d'un cabinet ni la continuité du service.",
          ],
        },
        {
          h: "7. Gratuité et fonctions",
          p: [
            "Dans cette version, le service est gratuit pour les patients. Il ne comporte ni avis, ni classement payant, ni paiement intégré.",
          ],
        },
        {
          h: "8. Droit applicable",
          p: ["Les présentes conditions sont soumises au droit tunisien. [Tribunal compétent à préciser.]"],
        },
      ],
    },
    ar: {
      title: "شروط الاستخدام",
      draft: "مشروع نص يجب أن يراجعه مختص قانوني قبل النشر. الفقرات بين [أقواس] تحتاج إلى استكمال.",
      sections: [
        {
          h: "1. الموضوع",
          p: [
            "تربط TawaDent بين المرضى وعيادات أسنان خاصة في تونس الكبرى عند الحالات الطارئة. TawaDent ليست مقدّمة للعلاج.",
          ],
        },
        {
          h: "2. لا استشارة طبية",
          p: [
            "لا يقوم التطبيق بأي تشخيص ولا يقدّم أي نصيحة طبية. في حالة الخطر على الحياة، اتصل فورًا بالرقم 190 (الإسعاف الطبي المستعجل).",
          ],
        },
        {
          h: "3. طريقة العمل",
          p: [
            "يختار المريض منطقته ثم يختار بحرية عيادة متاحة ويرسل طلبه. أمام العيادة 60 ثانية للتأكيد. عند القبول، يطّلع المريض على بيانات العيادة ومسار الوصول إليها. وإن لم تردّ العيادة، يمكن للمريض اختيار عيادة أخرى.",
            "تعلن العيادة توفرها لمدة 60 دقيقة. وتنهي الاستشارة المؤكدة، أو الطلب الذي بقي دون رد، هذا التوفر.",
          ],
        },
        {
          h: "4. التزامات المريض",
          p: [
            "تقديم معلومات صحيحة، وإرسال طلب واحد في كل مرة، وعدم إساءة استعمال الخدمة. عدد الطلبات محدود لتفادي التجاوزات.",
          ],
        },
        {
          h: "5. التزامات أطباء الأسنان",
          p: [
            "أن يكون الطبيب مسجّلًا في العمادة، وأن يقدّم ملفًا صحيحًا، وأن يعلن توفره بحسن نية، وأن يردّ بسرعة على الطلبات. تتم المصادقة على الملف يدويًا قبل ظهوره، ويمكن إيقافه عند الإخلال بالواجبات.",
          ],
        },
        {
          h: "6. المسؤولية",
          p: [
            "العلاقة العلاجية والأتعاب وجودة الأعمال الطبية تخصّ المريض وطبيب الأسنان وحدهما. لا تضمن TawaDent التوفر الفعلي للعيادة ولا استمرارية الخدمة.",
          ],
        },
        {
          h: "7. المجانية والخصائص",
          p: ["في هذه النسخة، الخدمة مجانية للمرضى، وليس فيها تقييمات ولا ترتيب مدفوع ولا دفع إلكتروني مدمج."],
        },
        {
          h: "8. القانون المنطبق",
          p: ["تخضع هذه الشروط للقانون التونسي. [المحكمة المختصة تحدد لاحقًا.]"],
        },
      ],
    },
  },
};
