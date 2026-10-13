-- =====================================================================
-- Mise à jour 2, SCRIPT 1 sur 2 : nouveaux états d'une demande.
-- À exécuter SEUL, d'abord, puis exécuter le script 2
-- (20261014000100_flutter_rules.sql).
-- (PostgreSQL ne permet pas d'utiliser une nouvelle valeur d'énumération
--  dans la même transaction que son ajout : d'où les deux scripts.)
--
--   accepted  = disponibilité confirmée, patient en route
--   arrived   = le patient a signalé son arrivée
--   completed = le dentiste a terminé la consultation
-- =====================================================================
alter type public.request_status add value if not exists 'arrived';
alter type public.request_status add value if not exists 'completed';
