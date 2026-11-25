import { getAddress, keccak256, sha256, slice, stringToHex, type Address, type Hex } from "viem";
import type { Answer, Arbiter, DeductionItem, Lease, Party } from "../types";

// Seed data for the lease desk of a small São Paulo agency. Ten deposits, one in every
// phase of the DepositVault state machine, amounts in USDG (6 decimals on chain).
// Hashes, salts and addresses are derived deterministically below so they are real
// 32-byte / 20-byte values and every render (server, client and scripts/seed.ts) agrees.
// Relative imports only, so tsx can load this file without the "@/" path alias.

/** The seed clock. Deadlines in the seed are judged against this instant. */
export const SEED_NOW = "2026-11-25T12:00:00Z";
export const DEFAULT_LEASE_ID = "rua-harmonia-302";

const wallet = (label: string): Address => getAddress(slice(keccak256(stringToHex(`cautio-seed-wallet:${label}`)), 12));
const photo = (path: string): Hex => sha256(stringToHex(`cautio-seed-photo:${path}`));
const salt = (label: string): Hex => keccak256(stringToHex(`cautio-seed-salt:${label}`));

const person = (name: string): Party => ({ name, address: wallet(name) });

/** A demo party with the same deterministic address the seed uses for that name. */
export function seedParty(name: string): Party {
  return person(name);
}

const camila: Arbiter = { ...person("Camila Rocha"), agency: "Rocha Imóveis, Pinheiros" };
const diego: Arbiter = { ...person("Diego Lima"), agency: "Lima & Prado Imóveis" };

function item(
  lease: string,
  id: string,
  label: string,
  amount: number,
  entryNote: string,
  exitNote: string,
  answer: Answer
): DeductionItem {
  return {
    id,
    label,
    amount,
    entryNote,
    exitNote,
    entryPhoto: photo(`${lease}/${id}/move-in.jpg`),
    exitPhoto: photo(`${lease}/${id}/move-out.jpg`),
    answer,
  };
}

const noOffers = { landlord: null, tenant: null, opened: false };

export const leases: Lease[] = [
  {
    id: "rua-harmonia-302",
    onchainId: 1,
    street: "Rua Harmonia 302, apt 41",
    neighborhood: "Vila Madalena",
    monthlyRent: 1000,
    deposit: 3000,
    openedOn: "2024-11-04",
    moveOutOn: "2026-11-20",
    phase: "Itemized",
    windowDays: 30,
    deadline: "2026-12-20T12:00:00Z",
    tenant: person("Larissa Mendes"),
    landlord: person("Otávio Ferraz"),
    arbiter: camila,
    items: [
      item(
        "rua-harmonia-302",
        "window",
        "Cracked bedroom window pane",
        400,
        "Pane intact, photographed on move-in day, 4 Nov 2024",
        "Diagonal crack across the lower left corner",
        "pending"
      ),
      item(
        "rua-harmonia-302",
        "paint",
        "Repaint living room walls",
        900,
        "Fresh white paint, landlord receipt from Oct 2024",
        "Scuffs behind the sofa and two nail holes",
        "pending"
      ),
    ],
    offers: noOffers,
    landlordAward: null,
    note: "Larissa moved out on 20 Nov. Otávio listed two deductions. Her answer is due.",
  },
  {
    id: "alameda-santos-1140",
    onchainId: 2,
    street: "Alameda Santos 1140, apt 87",
    neighborhood: "Jardim Paulista",
    monthlyRent: 1200,
    deposit: 3600,
    openedOn: "2023-10-16",
    moveOutOn: "2026-10-19",
    phase: "MoveOut",
    windowDays: 30,
    deadline: "2026-11-18T12:00:00Z",
    tenant: person("Rafael Okamoto"),
    landlord: person("Helena Vasconcelos"),
    arbiter: camila,
    items: [],
    offers: noOffers,
    landlordAward: null,
    note: "Helena never listed a deduction. The 30 day window closed on 18 Nov.",
  },
  {
    id: "avenida-ibirapuera-2330",
    onchainId: 3,
    street: "Avenida Ibirapuera 2330, apt 152",
    neighborhood: "Moema",
    monthlyRent: 1300,
    deposit: 3900,
    openedOn: "2024-03-01",
    moveOutOn: "2026-10-28",
    phase: "Revealed",
    windowDays: 30,
    deadline: "2026-12-05T12:00:00Z",
    tenant: person("Thiago Barbosa"),
    landlord: person("Marta Kowalski"),
    arbiter: camila,
    items: [
      item(
        "avenida-ibirapuera-2330",
        "hinge",
        "Broken kitchen cabinet hinge",
        120,
        "All cabinet doors closing flush",
        "Upper left door hanging from one hinge",
        "accepted"
      ),
      item(
        "avenida-ibirapuera-2330",
        "mould",
        "Mould treatment on bathroom ceiling",
        1150,
        "Ceiling clean, extractor fan working",
        "Black mould patch over the shower, fan dead",
        "disputed"
      ),
    ],
    offers: {
      landlord: { amount: 1150, salt: salt("ibirapuera/landlord") },
      tenant: { amount: 450, salt: salt("ibirapuera/tenant") },
      opened: true,
    },
    landlordAward: null,
    note: "Both final offers are open. Camila has to pick one of them.",
  },
  {
    id: "rua-cardeal-arcoverde-1520",
    onchainId: 4,
    street: "Rua Cardeal Arcoverde 1520, apt 23",
    neighborhood: "Pinheiros",
    monthlyRent: 1400,
    deposit: 4200,
    openedOn: "2025-01-10",
    moveOutOn: "2026-11-03",
    phase: "Sealed",
    windowDays: 30,
    deadline: "2026-12-02T12:00:00Z",
    tenant: person("Júlia Castanheira"),
    landlord: person("Roberto Saldanha"),
    arbiter: diego,
    items: [
      item(
        "rua-cardeal-arcoverde-1520",
        "carpet",
        "Replace stained bedroom carpet",
        1100,
        "Beige carpet, light wear near the door",
        "Two dark stains by the window, one burn mark",
        "disputed"
      ),
      item(
        "rua-cardeal-arcoverde-1520",
        "oven",
        "Deep clean of the oven",
        150,
        "Oven cleaned by the previous tenant",
        "Grease on the racks and door glass",
        "accepted"
      ),
    ],
    offers: { landlord: { amount: 1100, salt: salt("arcoverde/landlord") }, tenant: null, opened: false },
    landlordAward: null,
    note: "Roberto has sealed his number. Júlia still has to seal hers.",
  },
  {
    id: "rua-das-palmeiras-98",
    onchainId: 5,
    street: "Rua das Palmeiras 98, apt 6",
    neighborhood: "Santa Cecília",
    monthlyRent: 750,
    deposit: 2250,
    openedOn: "2024-06-20",
    moveOutOn: "2026-11-08",
    phase: "Ruled",
    windowDays: 30,
    deadline: null,
    tenant: person("André Siqueira"),
    landlord: person("Lúcia Matsumoto"),
    arbiter: diego,
    items: [
      item(
        "rua-das-palmeiras-98",
        "water",
        "Unpaid final Sabesp water bill",
        85,
        "Meter reading 1,204 m3 at handover",
        "Meter reading 1,262 m3, bill unpaid",
        "accepted"
      ),
      item(
        "rua-das-palmeiras-98",
        "shower",
        "Replace broken shower head",
        60,
        "Shower head working, no leaks",
        "Shower head cracked and leaking",
        "accepted"
      ),
    ],
    offers: noOffers,
    landlordAward: 145,
    note: "André accepted both items. One settle call pays out the deposit.",
  },
  {
    id: "rua-galvao-bueno-410",
    onchainId: 6,
    street: "Rua Galvão Bueno 410, apt 33",
    neighborhood: "Liberdade",
    monthlyRent: 700,
    deposit: 2100,
    openedOn: "2023-08-01",
    moveOutOn: "2026-09-30",
    phase: "Settled",
    windowDays: 30,
    deadline: null,
    tenant: person("Kenji Arakaki"),
    landlord: person("Fernanda Queiroz"),
    arbiter: camila,
    items: [
      item(
        "rua-galvao-bueno-410",
        "keys",
        "Missing key set and lock change",
        250,
        "Two key sets handed over",
        "One key set returned",
        "accepted"
      ),
    ],
    offers: noOffers,
    landlordAward: 250,
    note: "Settled on 14 Oct: 250 to Fernanda, 1,850 back to Kenji.",
  },
  {
    id: "rua-javari-1201",
    onchainId: 7,
    street: "Rua Javari 1201, casa 2",
    neighborhood: "Mooca",
    monthlyRent: 650,
    deposit: 1950,
    openedOn: "2024-02-12",
    moveOutOn: "2026-09-01",
    phase: "Settled",
    windowDays: 30,
    deadline: null,
    tenant: person("Patrícia Lacerda"),
    landlord: person("Wagner Tavares"),
    arbiter: diego,
    items: [],
    offers: noOffers,
    landlordAward: 0,
    note: "Wagner stayed silent for 30 days. Patrícia pulled the full 1,950 back.",
  },
  {
    id: "rua-alvarenga-1789",
    onchainId: 8,
    street: "Rua Alvarenga 1789, apt 104",
    neighborhood: "Butantã",
    monthlyRent: 900,
    deposit: 2700,
    openedOn: "2025-02-03",
    moveOutOn: "2026-11-19",
    phase: "MoveOut",
    windowDays: 30,
    deadline: "2026-12-19T12:00:00Z",
    tenant: person("Gabriel Teixeira"),
    landlord: person("Silvia Prates"),
    arbiter: diego,
    items: [],
    offers: noOffers,
    landlordAward: null,
    note: "Gabriel handed back the keys on 19 Nov. Silvia is still walking the flat.",
  },
  {
    id: "rua-augusta-871",
    onchainId: 9,
    street: "Rua Augusta 871, apt 12",
    neighborhood: "Consolação",
    monthlyRent: 800,
    deposit: 2400,
    openedOn: "2025-07-01",
    moveOutOn: null,
    phase: "Active",
    windowDays: 30,
    deadline: null,
    tenant: person("Beatriz Nogueira"),
    landlord: person("Sérgio Amaral"),
    arbiter: diego,
    items: [],
    offers: noOffers,
    landlordAward: null,
    note: "Deposit locked since July 2025. Lease runs to June 2027.",
  },
  {
    id: "rua-cayowaa-655",
    onchainId: 10,
    street: "Rua Cayowaá 655, apt 71",
    neighborhood: "Perdizes",
    monthlyRent: 950,
    deposit: 2850,
    openedOn: "2026-03-15",
    moveOutOn: null,
    phase: "Active",
    windowDays: 30,
    deadline: null,
    tenant: person("Mariana Esteves"),
    landlord: person("Eduardo Pacheco"),
    arbiter: camila,
    items: [],
    offers: noOffers,
    landlordAward: null,
    note: "Three months of rent locked in March. Nobody can touch it until move-out.",
  },
];
