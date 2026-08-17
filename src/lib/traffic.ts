/**
 * FlowGuard traffic model + simulation engine for Nagpur Signal Network.
 *
 * Full Nagpur signalized network covering all NMC administrative zones & wards:
 * Sitabuldi, Sadar, Dharampeth, Civil Lines, Wardha Road, Amravati Road,
 * Kamptee Road, Kalamna, Hingna, Manish Nagar, Wathoda, Nandanvan, Pardi,
 * Jaripatka, Mankapur, Trimurti Nagar, Pratap Nagar, Besa, and more.
 */

export type Zone =
  | "central"
  | "west"
  | "north"
  | "east"
  | "south"
  | "southwest"
  | "northeast"
  | "southeast";

export interface SignalDirections {
  north: number; // green time in seconds
  south: number;
  east: number;
  west: number;
}

export interface Junction {
  id: string;
  name: string;
  ward: string; // NMC Ward / Zone name
  zone: Zone;
  lat: number;
  lng: number;
  x: number; // normalized map space percentage (0-100)
  y: number;
  baseGreen: number; // overall seconds of green in standard base cycle
  demand: number; // relative vehicle demand multiplier (0.4 - 1.8)
  directions: SignalDirections;
  connected_junction_ids: string[];
  landmark?: string;
  lanes?: number;
}

export interface Corridor {
  id: string;
  name: string;
  from: string;
  to: string;
  lanes: number;
  highway: boolean;
  capacity: number; // vehicles / hour
}

export const NAGPUR_MAP_CENTER = { lat: 21.1458, lng: 79.0882 }; // Nagpur Zero Mile / Sitabuldi
export const NAGPUR_DEFAULT_ZOOM = 12.8;

// Nagpur Bounding Box for coordinate transformations
export const NAGPUR_BOUNDS = {
  minLat: 21.055,
  maxLat: 21.235,
  minLng: 78.985,
  maxLng: 79.185,
};

export const ZONE_LABEL: Record<Zone, string> = {
  central: "Central Business District (Sitabuldi / Civil Lines / Station)",
  west: "West Arterial (Dharampeth / Law College / Futala / Ravi Nagar)",
  north: "North Sector (Sadar / Koradi / Mankapur / Jaripatka)",
  east: "East Trade Belt (Gandhibagh / Itwari / Lakadganj / Kalamna)",
  south: "South Radial (Wardha Rd / Rahate Colony / Somalwada / Airport)",
  southwest: "South-West Sector (Pratap Nagar / Trimurti Nagar / Hingna)",
  northeast: "North-East Sector (Kamptee Road / Automotive / Pardi)",
  southeast: "South-East Belt (Medical / Nandanvan / Wathoda / Kharbi)",
};

/** NMC 10 Administrative Zones & Target Junctions for Coverage Checklist */
export interface WardCoverageInfo {
  id: string;
  name: string;
  targetCount: number;
  description: string;
}

export const NMC_WARDS: WardCoverageInfo[] = [
  { id: "W1", name: "Dharampeth Zone (Ward 1)", targetCount: 6, description: "Dharampeth, Law College, Coffee House, Ravi Nagar, Ramdaspeth" },
  { id: "W2", name: "Civil Lines & Sitabuldi (Ward 2)", targetCount: 8, description: "Sitabuldi, Zero Mile, Samvidhan Sq, High Court, Morris College" },
  { id: "W3", name: "Sadar & Mangalwari Zone (Ward 3)", targetCount: 6, description: "Sadar, RBI Sq, Liberty Sq, Katol Rd Sq, Mankapur" },
  { id: "W4", name: "Ashi Nagar & Jaripatka (Ward 4)", targetCount: 5, description: "Jaripatka, Kamptee Rd, Automotive Sq, Uppalwadi, Indora" },
  { id: "W5", name: "Satranjipura & Kalamna (Ward 5)", targetCount: 5, description: "Kalamna Market, Shanti Nagar, Itwari, Teen Nal" },
  { id: "W6", name: "Gandhibagh & Lakadganj (Ward 6)", targetCount: 6, description: "Gandhibagh, Cotton Market, Central Ave, Mayo Sq, Pardi" },
  { id: "W7", name: "Nehru Nagar & Nandanvan (Ward 7)", targetCount: 5, description: "Nandanvan, Wathoda, Hasanbagh, Kharbi, Dighori" },
  { id: "W8", name: "Hanuman Nagar & Medical (Ward 8)", targetCount: 5, description: "Medical Sq, Krida Sq, Tukdoji Maharaj Sq, Baidyanath Sq" },
  { id: "W9", name: "Dhantoli & Wardha Road (Ward 9)", targetCount: 6, description: "Rahate Colony, Congress Nagar, Ajni, Chatrapati Sq, Khamla" },
  { id: "W10", name: "Laxmi Nagar & South-West (Ward 10)", targetCount: 7, description: "Pratap Nagar, Trimurti Nagar, Manish Nagar, Somalwada, Hingna, Besa" },
];

/** Full 52+ Nagpur Signal Junction Dataset */
export const JUNCTIONS: Junction[] = [
  // --- Zone 1 & 2: Central & Civil Lines ---
  {
    id: "J1",
    name: "Zero Mile / Metro Interchange Hub",
    ward: "Civil Lines & Sitabuldi (Ward 2)",
    zone: "central",
    lat: 21.1466,
    lng: 79.0882,
    x: 51.7,
    y: 49.1,
    baseGreen: 50,
    demand: 1.6,
    directions: { north: 45, south: 45, east: 50, west: 50 },
    connected_junction_ids: ["J2", "J3", "J4", "J8", "J13"],
    landmark: "Zero Mile Stone & Metro Central Interchange",
    lanes: 4,
  },
  {
    id: "J2",
    name: "Samvidhan Chowk (RBI / Civil Lines Spine)",
    ward: "Civil Lines & Sitabuldi (Ward 2)",
    zone: "central",
    lat: 21.1512,
    lng: 79.0855,
    x: 50.3,
    y: 46.6,
    baseGreen: 46,
    demand: 1.55,
    directions: { north: 45, south: 45, east: 40, west: 45 },
    connected_junction_ids: ["J1", "J3", "J10", "J14"],
    landmark: "Dr. Babasaheb Ambedkar Statue / Reserve Bank",
    lanes: 4,
  },
  {
    id: "J3",
    name: "Nagpur Railway Station West Chowk",
    ward: "Civil Lines & Sitabuldi (Ward 2)",
    zone: "central",
    lat: 21.1534,
    lng: 79.0968,
    x: 56.0,
    y: 45.3,
    baseGreen: 42,
    demand: 1.45,
    directions: { north: 35, south: 35, east: 45, west: 40 },
    connected_junction_ids: ["J1", "J2", "J6", "J17"],
    landmark: "Nagpur Main Junction Railway Station",
    lanes: 3,
  },
  {
    id: "J4",
    name: "Sitabuldi Main Flyover / Munje Square",
    ward: "Civil Lines & Sitabuldi (Ward 2)",
    zone: "central",
    lat: 21.1441,
    lng: 79.0837,
    x: 49.4,
    y: 50.5,
    baseGreen: 48,
    demand: 1.5,
    directions: { north: 45, south: 45, east: 40, west: 45 },
    connected_junction_ids: ["J1", "J5", "J8", "J27"],
    landmark: "Munje Chowk / Sitabuldi Market",
    lanes: 3,
  },
  {
    id: "J5",
    name: "Jhansi Rani Square (Sitabuldi West)",
    ward: "Civil Lines & Sitabuldi (Ward 2)",
    zone: "central",
    lat: 21.1432,
    lng: 79.0784,
    x: 46.7,
    y: 51.0,
    baseGreen: 40,
    demand: 1.35,
    directions: { north: 35, south: 35, east: 40, west: 40 },
    connected_junction_ids: ["J4", "J20", "J27"],
    landmark: "Jhansi Rani Statue & Metro Station",
    lanes: 3,
  },
  {
    id: "J6",
    name: "Cotton Market / Ghat Road Square",
    ward: "Gandhibagh & Lakadganj (Ward 6)",
    zone: "east",
    lat: 21.1455,
    lng: 79.1022,
    x: 58.7,
    y: 49.7,
    baseGreen: 38,
    demand: 1.25,
    directions: { north: 35, south: 35, east: 40, west: 35 },
    connected_junction_ids: ["J3", "J7", "J29"],
    landmark: "Cotton Market Vegetable Terminal",
    lanes: 3,
  },
  {
    id: "J7",
    name: "Gandhibagh / Agrasen Chowk",
    ward: "Gandhibagh & Lakadganj (Ward 6)",
    zone: "east",
    lat: 21.1495,
    lng: 79.1124,
    x: 63.8,
    y: 47.5,
    baseGreen: 36,
    demand: 1.2,
    directions: { north: 35, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J6", "J18", "J30"],
    landmark: "Agrasen Chowk Central Avenue",
    lanes: 3,
  },
  {
    id: "J8",
    name: "Rahate Colony / Wardha Road Arterial",
    ward: "Dhantoli & Wardha Road (Ward 9)",
    zone: "south",
    lat: 21.1278,
    lng: 79.0818,
    x: 48.5,
    y: 59.6,
    baseGreen: 45,
    demand: 1.4,
    directions: { north: 50, south: 50, east: 35, west: 35 },
    connected_junction_ids: ["J1", "J4", "J9", "J28", "J35"],
    landmark: "Rahate Colony Metro & Wardha Road",
    lanes: 4,
  },
  {
    id: "J9",
    name: "Chatrapati Square (Wardha Rd & Ring Rd)",
    ward: "Dhantoli & Wardha Road (Ward 9)",
    zone: "south",
    lat: 21.1095,
    lng: 79.0745,
    x: 44.8,
    y: 69.7,
    baseGreen: 48,
    demand: 1.5,
    directions: { north: 50, south: 50, east: 45, west: 45 },
    connected_junction_ids: ["J8", "J36", "J37", "J38"],
    landmark: "Chatrapati Shivaji Maharaj Statue / Ring Road",
    lanes: 4,
  },

  // --- Zone 3: Sadar & Mangalwari (North) ---
  {
    id: "J10",
    name: "RBI Square / Sadar Flyover Approach",
    ward: "Sadar & Mangalwari Zone (Ward 3)",
    zone: "north",
    lat: 21.1578,
    lng: 79.0805,
    x: 47.8,
    y: 42.9,
    baseGreen: 42,
    demand: 1.3,
    directions: { north: 45, south: 45, east: 35, west: 40 },
    connected_junction_ids: ["J2", "J11", "J12", "J14"],
    landmark: "Reserve Bank of India Regional HQ",
    lanes: 4,
  },
  {
    id: "J11",
    name: "Liberty Cinema Square (Sadar)",
    ward: "Sadar & Mangalwari Zone (Ward 3)",
    zone: "north",
    lat: 21.1645,
    lng: 79.0782,
    x: 46.7,
    y: 39.2,
    baseGreen: 38,
    demand: 1.15,
    directions: { north: 40, south: 40, east: 35, west: 35 },
    connected_junction_ids: ["J10", "J12", "J15"],
    landmark: "Residency Road / Sadar Commercial Market",
    lanes: 3,
  },
  {
    id: "J12",
    name: "Katol Road Square / Chhindwara Road",
    ward: "Sadar & Mangalwari Zone (Ward 3)",
    zone: "north",
    lat: 21.1685,
    lng: 79.0685,
    x: 41.8,
    y: 36.9,
    baseGreen: 36,
    demand: 1.05,
    directions: { north: 40, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J10", "J11", "J24", "J47"],
    landmark: "Katol Naka Arterial",
    lanes: 3,
  },
  {
    id: "J13",
    name: "GPO Square (Civil Lines)",
    ward: "Civil Lines & Sitabuldi (Ward 2)",
    zone: "central",
    lat: 21.1542,
    lng: 79.0762,
    x: 45.6,
    y: 44.9,
    baseGreen: 35,
    demand: 0.95,
    directions: { north: 35, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J1", "J10", "J14", "J20"],
    landmark: "Nagpur General Post Office (Heritage)",
    lanes: 3,
  },
  {
    id: "J14",
    name: "High Court / Ladies Club Square",
    ward: "Civil Lines & Sitabuldi (Ward 2)",
    zone: "central",
    lat: 21.1565,
    lng: 79.0698,
    x: 42.4,
    y: 43.6,
    baseGreen: 35,
    demand: 0.9,
    directions: { north: 35, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J2", "J10", "J13", "J21"],
    landmark: "Bombay High Court Nagpur Bench",
    lanes: 3,
  },
  {
    id: "J15",
    name: "Mankapur Sports Stadium Square",
    ward: "Sadar & Mangalwari Zone (Ward 3)",
    zone: "north",
    lat: 21.1875,
    lng: 79.0765,
    x: 45.8,
    y: 26.4,
    baseGreen: 40,
    demand: 1.1,
    directions: { north: 45, south: 45, east: 35, west: 35 },
    connected_junction_ids: ["J11", "J16", "J48"],
    landmark: "Divisional Sports Complex Mankapur",
    lanes: 4,
  },
  {
    id: "J16",
    name: "Koradi Road Octroi Naka Square",
    ward: "Sadar & Mangalwari Zone (Ward 3)",
    zone: "north",
    lat: 21.2155,
    lng: 79.0722,
    x: 43.6,
    y: 10.8,
    baseGreen: 45,
    demand: 1.2,
    directions: { north: 50, south: 50, east: 30, west: 30 },
    connected_junction_ids: ["J15"],
    landmark: "Koradi Thermal Power Express Route",
    lanes: 4,
  },

  // --- Zone 4: Ashi Nagar & Jaripatka (North-East / Kamptee Rd) ---
  {
    id: "J17",
    name: "Mayo Hospital / Dosar Vaishya Chowk",
    ward: "Gandhibagh & Lakadganj (Ward 6)",
    zone: "east",
    lat: 21.1548,
    lng: 79.1042,
    x: 59.7,
    y: 44.5,
    baseGreen: 38,
    demand: 1.25,
    directions: { north: 40, south: 40, east: 35, west: 35 },
    connected_junction_ids: ["J3", "J18", "J19"],
    landmark: "Indira Gandhi Govt Medical College (Mayo)",
    lanes: 3,
  },
  {
    id: "J18",
    name: "Kadbi Chowk / Kamptee Road",
    ward: "Ashi Nagar & Jaripatka (Ward 4)",
    zone: "northeast",
    lat: 21.1682,
    lng: 79.0988,
    x: 57.0,
    y: 37.1,
    baseGreen: 42,
    demand: 1.35,
    directions: { north: 45, south: 45, east: 35, west: 35 },
    connected_junction_ids: ["J7", "J17", "J19", "J45"],
    landmark: "Kamptee Road Metro Corridor",
    lanes: 4,
  },
  {
    id: "J19",
    name: "Indora Square / 10 No. Pulia",
    ward: "Ashi Nagar & Jaripatka (Ward 4)",
    zone: "northeast",
    lat: 21.1765,
    lng: 79.1045,
    x: 59.8,
    y: 32.5,
    baseGreen: 44,
    demand: 1.4,
    directions: { north: 45, south: 45, east: 40, west: 40 },
    connected_junction_ids: ["J18", "J45", "J46"],
    landmark: "Indora Chowk Double Decker Flyover",
    lanes: 4,
  },

  // --- Zone 5: Dharampeth & West Arterial ---
  {
    id: "J20",
    name: "Coffee House Square (Dharampeth)",
    ward: "Dharampeth Zone (Ward 1)",
    zone: "west",
    lat: 21.1448,
    lng: 79.0665,
    x: 40.8,
    y: 50.1,
    baseGreen: 38,
    demand: 1.25,
    directions: { north: 35, south: 35, east: 40, west: 40 },
    connected_junction_ids: ["J5", "J13", "J21", "J22", "J27"],
    landmark: "Indian Coffee House Dharampeth",
    lanes: 3,
  },
  {
    id: "J21",
    name: "Law College Square (Amravati Road)",
    ward: "Dharampeth Zone (Ward 1)",
    zone: "west",
    lat: 21.1482,
    lng: 79.0585,
    x: 36.8,
    y: 48.2,
    baseGreen: 45,
    demand: 1.45,
    directions: { north: 40, south: 40, east: 45, west: 45 },
    connected_junction_ids: ["J14", "J20", "J23", "J24"],
    landmark: "Dr. Ambedkar College of Law / Amravati Highway",
    lanes: 4,
  },
  {
    id: "J22",
    name: "Shankar Nagar Square (WHC Road)",
    ward: "Dharampeth Zone (Ward 1)",
    zone: "west",
    lat: 21.1375,
    lng: 79.0628,
    x: 38.9,
    y: 54.2,
    baseGreen: 42,
    demand: 1.35,
    directions: { north: 40, south: 40, east: 40, west: 40 },
    connected_junction_ids: ["J20", "J25", "J26", "J27"],
    landmark: "Shankar Nagar Petrol Pump & Garden",
    lanes: 3,
  },
  {
    id: "J23",
    name: "Ravi Nagar Square / University Campus",
    ward: "Dharampeth Zone (Ward 1)",
    zone: "west",
    lat: 21.1518,
    lng: 79.0475,
    x: 31.3,
    y: 46.2,
    baseGreen: 44,
    demand: 1.35,
    directions: { north: 40, south: 40, east: 45, west: 45 },
    connected_junction_ids: ["J21", "J24", "J49"],
    landmark: "RTMNU Campus & CPWD Colony",
    lanes: 4,
  },
  {
    id: "J24",
    name: "Futala Lake T-Point / Seminary Hills",
    ward: "Dharampeth Zone (Ward 1)",
    zone: "west",
    lat: 21.1585,
    lng: 79.0435,
    x: 29.3,
    y: 42.5,
    baseGreen: 32,
    demand: 0.85,
    directions: { north: 30, south: 30, east: 35, west: 35 },
    connected_junction_ids: ["J12", "J21", "J23"],
    landmark: "Futala Lake Promenade & Musical Fountain",
    lanes: 2,
  },
  {
    id: "J25",
    name: "Bajaj Nagar / Laxmi Nagar Square",
    ward: "Laxmi Nagar & South-West (Ward 10)",
    zone: "southwest",
    lat: 21.1275,
    lng: 79.0615,
    x: 38.3,
    y: 59.7,
    baseGreen: 40,
    demand: 1.25,
    directions: { north: 40, south: 40, east: 35, west: 35 },
    connected_junction_ids: ["J22", "J26", "J36", "J37"],
    landmark: "VNIT Gate & Laxmi Nagar Water Tank",
    lanes: 3,
  },
  {
    id: "J26",
    name: "Abhyankar Nagar / Mate Square",
    ward: "Laxmi Nagar & South-West (Ward 10)",
    zone: "southwest",
    lat: 21.1245,
    lng: 79.0525,
    x: 33.8,
    y: 61.4,
    baseGreen: 36,
    demand: 1.1,
    directions: { north: 35, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J22", "J25", "J39"],
    landmark: "Mate Chowk & VNIT South Gate",
    lanes: 3,
  },
  {
    id: "J27",
    name: "Ramdaspeth / Lokmat Square",
    ward: "Dhantoli & Wardha Road (Ward 9)",
    zone: "central",
    lat: 21.1365,
    lng: 79.0768,
    x: 46.0,
    y: 54.7,
    baseGreen: 42,
    demand: 1.3,
    directions: { north: 40, south: 40, east: 40, west: 40 },
    connected_junction_ids: ["J4", "J5", "J8", "J20", "J22"],
    landmark: "Lokmat Bhavan & Panchsheel Square",
    lanes: 3,
  },

  // --- Zone 6: Hanuman Nagar & Medical (South-East) ---
  {
    id: "J28",
    name: "Medical Square (GMC / Ajni Spine)",
    ward: "Hanuman Nagar & Medical (Ward 8)",
    zone: "southeast",
    lat: 21.1315,
    lng: 79.0985,
    x: 56.8,
    y: 57.5,
    baseGreen: 46,
    demand: 1.45,
    directions: { north: 45, south: 45, east: 45, west: 45 },
    connected_junction_ids: ["J8", "J29", "J31", "J34", "J35"],
    landmark: "Government Medical College (GMC) & Super Speciality",
    lanes: 4,
  },
  {
    id: "J29",
    name: "Baidyanath Square / Great Nag Road",
    ward: "Hanuman Nagar & Medical (Ward 8)",
    zone: "southeast",
    lat: 21.1395,
    lng: 79.1065,
    x: 60.8,
    y: 53.1,
    baseGreen: 40,
    demand: 1.2,
    directions: { north: 40, south: 40, east: 35, west: 35 },
    connected_junction_ids: ["J6", "J28", "J30", "J33"],
    landmark: "Baidyanath Chowk & Ayurvedic Complex",
    lanes: 3,
  },
  {
    id: "J30",
    name: "Shahid Chowk / Itwari Trade Square",
    ward: "Satranjipura & Kalamna (Ward 5)",
    zone: "east",
    lat: 21.1555,
    lng: 79.1215,
    x: 68.3,
    y: 44.1,
    baseGreen: 36,
    demand: 1.15,
    directions: { north: 35, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J7", "J29", "J32", "J42"],
    landmark: "Itwari Grain & Sarafa Wholesale Market",
    lanes: 2,
  },
  {
    id: "J31",
    name: "Krida Square / Tukdoji Maharaj Chowk",
    ward: "Hanuman Nagar & Medical (Ward 8)",
    zone: "southeast",
    lat: 21.1215,
    lng: 79.1055,
    x: 60.3,
    y: 63.1,
    baseGreen: 40,
    demand: 1.2,
    directions: { north: 40, south: 40, east: 35, west: 35 },
    connected_junction_ids: ["J28", "J33", "J34"],
    landmark: "Tukdoji Putla & Krida Chowk Complex",
    lanes: 3,
  },
  {
    id: "J32",
    name: "Lakadganj / Telephone Exchange Square",
    ward: "Gandhibagh & Lakadganj (Ward 6)",
    zone: "east",
    lat: 21.1485,
    lng: 79.1315,
    x: 73.3,
    y: 48.1,
    baseGreen: 40,
    demand: 1.25,
    directions: { north: 35, south: 35, east: 45, west: 45 },
    connected_junction_ids: ["J7", "J30", "J33", "J43"],
    landmark: "Telephone Exchange Chowk Central Ave",
    lanes: 4,
  },
  {
    id: "J33",
    name: "Nandanvan Water Tank Square",
    ward: "Nehru Nagar & Nandanvan (Ward 7)",
    zone: "southeast",
    lat: 21.1345,
    lng: 79.1285,
    x: 71.8,
    y: 55.8,
    baseGreen: 38,
    demand: 1.15,
    directions: { north: 35, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J29", "J31", "J32", "J44"],
    landmark: "Nandanvan Main Road & KDK College",
    lanes: 3,
  },
  {
    id: "J34",
    name: "Reshimbagh / Suresh Bhat Auditorium Square",
    ward: "Hanuman Nagar & Medical (Ward 8)",
    zone: "southeast",
    lat: 21.1275,
    lng: 79.1125,
    x: 63.8,
    y: 59.7,
    baseGreen: 36,
    demand: 1.1,
    directions: { north: 35, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J28", "J31", "J44"],
    landmark: "Kavivarya Suresh Bhat Sabhagruh & Ground",
    lanes: 3,
  },
  {
    id: "J35",
    name: "Ajni Railway Station / Chunabhatti Square",
    ward: "Dhantoli & Wardha Road (Ward 9)",
    zone: "south",
    lat: 21.1195,
    lng: 79.0885,
    x: 51.8,
    y: 64.2,
    baseGreen: 38,
    demand: 1.15,
    directions: { north: 40, south: 40, east: 35, west: 35 },
    connected_junction_ids: ["J8", "J28", "J36"],
    landmark: "Ajni Railway Terminus & Cable Stayed Bridge",
    lanes: 3,
  },

  // --- Zone 7: South Radial, Airport & Manish Nagar ---
  {
    id: "J36",
    name: "Narendra Nagar Flyover Square",
    ward: "Dhantoli & Wardha Road (Ward 9)",
    zone: "south",
    lat: 21.1025,
    lng: 79.0815,
    x: 48.3,
    y: 73.6,
    baseGreen: 44,
    demand: 1.35,
    directions: { north: 45, south: 45, east: 40, west: 40 },
    connected_junction_ids: ["J9", "J25", "J35", "J38", "J40"],
    landmark: "Narendra Nagar Ring Road Flyover",
    lanes: 4,
  },
  {
    id: "J37",
    name: "Pratap Nagar Square (Ring Road Radial)",
    ward: "Laxmi Nagar & South-West (Ward 10)",
    zone: "southwest",
    lat: 21.1145,
    lng: 79.0585,
    x: 36.8,
    y: 66.9,
    baseGreen: 42,
    demand: 1.3,
    directions: { north: 40, south: 40, east: 40, west: 40 },
    connected_junction_ids: ["J9", "J25", "J38", "J39"],
    landmark: "Pratap Nagar Ring Road Junction",
    lanes: 4,
  },
  {
    id: "J38",
    name: "Khamla Square (Deo Nagar Arterial)",
    ward: "Dhantoli & Wardha Road (Ward 9)",
    zone: "southwest",
    lat: 21.1115,
    lng: 79.0665,
    x: 40.8,
    y: 68.6,
    baseGreen: 38,
    demand: 1.15,
    directions: { north: 35, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J9", "J36", "J37", "J41"],
    landmark: "Khamla Sindhi Hindi School & Market",
    lanes: 3,
  },
  {
    id: "J39",
    name: "Trimurti Nagar Square (Hingna Approach)",
    ward: "Laxmi Nagar & South-West (Ward 10)",
    zone: "southwest",
    lat: 21.1185,
    lng: 79.0435,
    x: 29.3,
    y: 64.7,
    baseGreen: 40,
    demand: 1.25,
    directions: { north: 40, south: 40, east: 35, west: 35 },
    connected_junction_ids: ["J26", "J37", "J51"],
    landmark: "Trimurti Nagar Commercial Spine",
    lanes: 3,
  },
  {
    id: "J40",
    name: "Manish Nagar T-Point / Railway Crossing",
    ward: "Laxmi Nagar & South-West (Ward 10)",
    zone: "south",
    lat: 21.0915,
    lng: 79.0885,
    x: 51.8,
    y: 79.7,
    baseGreen: 46,
    demand: 1.5,
    directions: { north: 45, south: 45, east: 40, west: 40 },
    connected_junction_ids: ["J36", "J41", "J52"],
    landmark: "Manish Nagar Underpass & Shopping Belt",
    lanes: 3,
  },
  {
    id: "J41",
    name: "Somalwada / Wardha Road Airport Chowk",
    ward: "Laxmi Nagar & South-West (Ward 10)",
    zone: "south",
    lat: 21.0965,
    lng: 79.0715,
    x: 43.3,
    y: 76.9,
    baseGreen: 48,
    demand: 1.45,
    directions: { north: 50, south: 50, east: 40, west: 40 },
    connected_junction_ids: ["J38", "J40", "J50"],
    landmark: "Dr. Babasaheb Ambedkar International Airport Approach",
    lanes: 4,
  },

  // --- Zone 8 & 9: East / Kalamna / Wathoda / Pardi ---
  {
    id: "J42",
    name: "Kalamna Market / HB Town Square",
    ward: "Satranjipura & Kalamna (Ward 5)",
    zone: "east",
    lat: 21.1685,
    lng: 79.1415,
    x: 78.3,
    y: 36.9,
    baseGreen: 42,
    demand: 1.3,
    directions: { north: 45, south: 45, east: 40, west: 40 },
    connected_junction_ids: ["J30", "J43", "J46"],
    landmark: "Kalamna Agriculture Produce Market Terminal (APMC)",
    lanes: 4,
  },
  {
    id: "J43",
    name: "Pardi Octroi Naka / Bhandara Road",
    ward: "Gandhibagh & Lakadganj (Ward 6)",
    zone: "east",
    lat: 21.1445,
    lng: 79.1585,
    x: 86.8,
    y: 50.3,
    baseGreen: 44,
    demand: 1.35,
    directions: { north: 40, south: 40, east: 50, west: 50 },
    connected_junction_ids: ["J32", "J42", "J44"],
    landmark: "Pardi National Highway 53 Flyover",
    lanes: 4,
  },
  {
    id: "J44",
    name: "Wathoda Ring Road Square (Symbiosis Hub)",
    ward: "Nehru Nagar & Nandanvan (Ward 7)",
    zone: "southeast",
    lat: 21.1215,
    lng: 79.1485,
    x: 81.8,
    y: 63.1,
    baseGreen: 42,
    demand: 1.25,
    directions: { north: 40, south: 40, east: 40, west: 40 },
    connected_junction_ids: ["J33", "J34", "J43"],
    landmark: "Symbiosis International University Nagpur Campus",
    lanes: 4,
  },

  // --- Zone 10: North-East & South-West Outer Ring ---
  {
    id: "J45",
    name: "Jaripatka Main Market Square",
    ward: "Ashi Nagar & Jaripatka (Ward 4)",
    zone: "north",
    lat: 21.1815,
    lng: 79.0895,
    x: 52.3,
    y: 29.7,
    baseGreen: 38,
    demand: 1.2,
    directions: { north: 35, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J15", "J18", "J19", "J46"],
    landmark: "Jaripatka Commercial Hub & Dayanand Park",
    lanes: 3,
  },
  {
    id: "J46",
    name: "Automotive Square (Kamptee Road NH44)",
    ward: "Ashi Nagar & Jaripatka (Ward 4)",
    zone: "northeast",
    lat: 21.1945,
    lng: 79.1165,
    x: 65.8,
    y: 22.5,
    baseGreen: 48,
    demand: 1.5,
    directions: { north: 50, south: 50, east: 45, west: 45 },
    connected_junction_ids: ["J19", "J42", "J45"],
    landmark: "Automotive Square NH44 Flyover",
    lanes: 4,
  },
  {
    id: "J47",
    name: "Gorewada Zoo / Ring Road T-Point",
    ward: "Sadar & Mangalwari Zone (Ward 3)",
    zone: "north",
    lat: 21.1825,
    lng: 79.0455,
    x: 30.3,
    y: 29.2,
    baseGreen: 36,
    demand: 0.95,
    directions: { north: 35, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J12", "J48"],
    landmark: "Balasaheb Thackeray Gorewada International Zoo",
    lanes: 3,
  },
  {
    id: "J48",
    name: "Godhani Railway Crossing Square",
    ward: "Sadar & Mangalwari Zone (Ward 3)",
    zone: "north",
    lat: 21.2015,
    lng: 79.0585,
    x: 36.8,
    y: 18.6,
    baseGreen: 35,
    demand: 0.9,
    directions: { north: 35, south: 35, east: 35, west: 35 },
    connected_junction_ids: ["J15", "J47"],
    landmark: "Godhani Railway Station Outer Radial",
    lanes: 2,
  },
  {
    id: "J49",
    name: "Wadi / Amravati Highway Octroi Square",
    ward: "Dharampeth Zone (Ward 1)",
    zone: "west",
    lat: 21.1495,
    lng: 79.0125,
    x: 13.8,
    y: 47.5,
    baseGreen: 45,
    demand: 1.4,
    directions: { north: 35, south: 35, east: 50, west: 50 },
    connected_junction_ids: ["J23", "J51"],
    landmark: "Wadi Toll Plaza & Logistics Park (NH53)",
    lanes: 4,
  },
  {
    id: "J50",
    name: "MIHAN / Khapri Metro Station Square",
    ward: "Laxmi Nagar & South-West (Ward 10)",
    zone: "south",
    lat: 21.0685,
    lng: 79.0625,
    x: 38.8,
    y: 92.5,
    baseGreen: 45,
    demand: 1.3,
    directions: { north: 45, south: 45, east: 35, west: 35 },
    connected_junction_ids: ["J41", "J52"],
    landmark: "MIHAN SEZ & AIIMS Nagpur Terminal",
    lanes: 4,
  },
  {
    id: "J51",
    name: "MIDC Hingna T-Point / Electronic Zone",
    ward: "Laxmi Nagar & South-West (Ward 10)",
    zone: "southwest",
    lat: 21.1085,
    lng: 79.0185,
    x: 16.8,
    y: 70.3,
    baseGreen: 44,
    demand: 1.35,
    directions: { north: 40, south: 40, east: 45, west: 45 },
    connected_junction_ids: ["J39", "J49"],
    landmark: "Hingna Industrial Area Main Gate",
    lanes: 4,
  },
  {
    id: "J52",
    name: "Besa – Ghogli Road T-Point",
    ward: "Laxmi Nagar & South-West (Ward 10)",
    zone: "south",
    lat: 21.0795,
    lng: 79.0965,
    x: 55.8,
    y: 86.4,
    baseGreen: 38,
    demand: 1.15,
    directions: { north: 40, south: 40, east: 35, west: 35 },
    connected_junction_ids: ["J40", "J50"],
    landmark: "Besa Residential Arterial Junction",
    lanes: 3,
  },
];

/** 75+ Road Corridors connecting all 52 Nagpur junctions into a network */
export const CORRIDORS: Corridor[] = [
  // --- Central Spine & Civil Lines ---
  { id: "C1", name: "Zero Mile – Samvidhan Main Spine", from: "J1", to: "J2", lanes: 4, highway: true, capacity: 6200 },
  { id: "C2", name: "Zero Mile – Railway Station West Link", from: "J1", to: "J3", lanes: 3, highway: false, capacity: 4500 },
  { id: "C3", name: "Zero Mile – Sitabuldi Flyover", from: "J1", to: "J4", lanes: 4, highway: true, capacity: 5800 },
  { id: "C4", name: "Zero Mile – Rahate Colony Wardha Spine", from: "J1", to: "J8", lanes: 4, highway: true, capacity: 6400 },
  { id: "C5", name: "Samvidhan – GPO Heritage Link", from: "J2", to: "J13", lanes: 3, highway: false, capacity: 3600 },
  { id: "C6", name: "Samvidhan – High Court Boulevard", from: "J2", to: "J14", lanes: 3, highway: false, capacity: 3800 },
  { id: "C7", name: "Samvidhan – RBI Sadar Arterial", from: "J2", to: "J10", lanes: 4, highway: true, capacity: 5500 },
  { id: "C8", name: "Sitabuldi – Jhansi Rani Metro Link", from: "J4", to: "J5", lanes: 3, highway: false, capacity: 3800 },
  { id: "C9", name: "Jhansi Rani – Coffee House Connector", from: "J5", to: "J20", lanes: 3, highway: false, capacity: 3600 },
  { id: "C10", name: "Sitabuldi – Lokmat Square Arterial", from: "J4", to: "J27", lanes: 3, highway: false, capacity: 4200 },
  { id: "C11", name: "Lokmat – Rahate Colony Link", from: "J27", to: "J8", lanes: 3, highway: false, capacity: 4400 },

  // --- Sadar & North Corridors ---
  { id: "C12", name: "RBI – Liberty Sadar Residency Rd", from: "J10", to: "J11", lanes: 3, highway: false, capacity: 4200 },
  { id: "C13", name: "RBI – Katol Road Arterial", from: "J10", to: "J12", lanes: 3, highway: false, capacity: 3900 },
  { id: "C14", name: "Liberty – Katol Road Connector", from: "J11", to: "J12", lanes: 2, highway: false, capacity: 2800 },
  { id: "C15", name: "Liberty – Mankapur Stadium North", from: "J11", to: "J15", lanes: 4, highway: true, capacity: 5400 },
  { id: "C16", name: "Mankapur – Koradi Road Express", from: "J15", to: "J16", lanes: 4, highway: true, capacity: 6000 },
  { id: "C17", name: "Katol Rd – Gorewada Ring Rd", from: "J12", to: "J47", lanes: 3, highway: true, capacity: 4600 },
  { id: "C18", name: "Gorewada – Godhani Outer Connector", from: "J47", to: "J48", lanes: 2, highway: false, capacity: 2600 },
  { id: "C19", name: "Godhani – Mankapur Link", from: "J48", to: "J15", lanes: 2, highway: false, capacity: 2800 },

  // --- East, Itwari & Gandhibagh Corridors ---
  { id: "C20", name: "Station West – Mayo Hospital Central Ave", from: "J3", to: "J17", lanes: 3, highway: true, capacity: 4800 },
  { id: "C21", name: "Mayo – Agrasen Chowk Central Ave", from: "J17", to: "J7", lanes: 4, highway: true, capacity: 5600 },
  { id: "C22", name: "Agrasen – Shahid Chowk Itwari", from: "J7", to: "J30", lanes: 2, highway: false, capacity: 2900 },
  { id: "C23", name: "Agrasen – Telephone Exchange CA Flyover", from: "J7", to: "J32", lanes: 4, highway: true, capacity: 5800 },
  { id: "C24", name: "Station – Cotton Market Connector", from: "J3", to: "J6", lanes: 3, highway: false, capacity: 3900 },
  { id: "C25", name: "Cotton Market – Baidyanath Great Nag Rd", from: "J6", to: "J29", lanes: 3, highway: false, capacity: 4100 },
  { id: "C26", name: "Baidyanath – Medical Square Spine", from: "J29", to: "J28", lanes: 3, highway: false, capacity: 4600 },
  { id: "C27", name: "Baidyanath – Shahid Chowk Trade Link", from: "J29", to: "J30", lanes: 2, highway: false, capacity: 2700 },
  { id: "C28", name: "Telephone Exchange – Lakadganj Pardi NH53", from: "J32", to: "J43", lanes: 4, highway: true, capacity: 6200 },
  { id: "C29", name: "Pardi – Kalamna Market Connector", from: "J43", to: "J42", lanes: 3, highway: true, capacity: 4800 },
  { id: "C30", name: "Itwari – Kalamna Market Spine", from: "J30", to: "J42", lanes: 3, highway: false, capacity: 3700 },

  // --- North-East & Kamptee Road Corridors ---
  { id: "C31", name: "Mayo – Kadbi Chowk Kamptee Link", from: "J17", to: "J18", lanes: 4, highway: true, capacity: 5400 },
  { id: "C32", name: "Kadbi – Indora Chowk Double Decker", from: "J18", to: "J19", lanes: 4, highway: true, capacity: 6000 },
  { id: "C33", name: "Indora – Automotive Square NH44", from: "J19", to: "J46", lanes: 4, highway: true, capacity: 6600 },
  { id: "C34", name: "Indora – Jaripatka Market Link", from: "J19", to: "J45", lanes: 3, highway: false, capacity: 3500 },
  { id: "C35", name: "Jaripatka – Mankapur Radial", from: "J45", to: "J15", lanes: 3, highway: false, capacity: 3400 },
  { id: "C36", name: "Automotive – Kalamna Market NH44", from: "J46", to: "J42", lanes: 4, highway: true, capacity: 5900 },

  // --- West & Dharampeth Corridors ---
  { id: "C37", name: "Coffee House – Law College Amravati Spine", from: "J20", to: "J21", lanes: 3, highway: false, capacity: 4200 },
  { id: "C38", name: "Law College – Ravi Nagar Arterial", from: "J21", to: "J23", lanes: 4, highway: true, capacity: 5800 },
  { id: "C39", name: "Ravi Nagar – Futala Lake Scenic Bypass", from: "J23", to: "J24", lanes: 2, highway: false, capacity: 2500 },
  { id: "C40", name: "Futala – Katol Road Connector", from: "J24", to: "J12", lanes: 2, highway: false, capacity: 2700 },
  { id: "C41", name: "Ravi Nagar – Wadi Amravati Highway NH53", from: "J23", to: "J49", lanes: 4, highway: true, capacity: 6400 },
  { id: "C42", name: "Coffee House – Shankar Nagar WHC Rd", from: "J20", to: "J22", lanes: 3, highway: false, capacity: 4100 },
  { id: "C43", name: "Shankar Nagar – Bajaj Nagar Arterial", from: "J22", to: "J25", lanes: 3, highway: false, capacity: 4300 },
  { id: "C44", name: "Bajaj Nagar – Mate Chowk Connector", from: "J25", to: "J26", lanes: 3, highway: false, capacity: 3600 },
  { id: "C45", name: "Shankar Nagar – Lokmat Square Link", from: "J22", to: "J27", lanes: 3, highway: false, capacity: 3900 },

  // --- South & Wardha Road Corridors ---
  { id: "C46", name: "Rahate Colony – Medical College Connector", from: "J8", to: "J28", lanes: 3, highway: false, capacity: 4500 },
  { id: "C47", name: "Rahate Colony – Ajni Station Flyover", from: "J8", to: "J35", lanes: 3, highway: false, capacity: 4200 },
  { id: "C48", name: "Rahate Colony – Chatrapati Sq Main Arterial", from: "J8", to: "J9", lanes: 4, highway: true, capacity: 6200 },
  { id: "C49", name: "Chatrapati Sq – Narendra Nagar Ring Rd", from: "J9", to: "J36", lanes: 4, highway: true, capacity: 6000 },
  { id: "C50", name: "Chatrapati Sq – Pratap Nagar Ring Rd", from: "J9", to: "J37", lanes: 4, highway: true, capacity: 5800 },
  { id: "C51", name: "Chatrapati Sq – Khamla Deo Nagar Link", from: "J9", to: "J38", lanes: 3, highway: false, capacity: 3800 },
  { id: "C52", name: "Ajni – Medical College Link", from: "J35", to: "J28", lanes: 2, highway: false, capacity: 3200 },
  { id: "C53", name: "Ajni – Narendra Nagar Arterial", from: "J35", to: "J36", lanes: 3, highway: false, capacity: 3900 },

  // --- South-West & Hingna Corridors ---
  { id: "C54", name: "Pratap Nagar – Bajaj Nagar Arterial", from: "J37", to: "J25", lanes: 3, highway: false, capacity: 4200 },
  { id: "C55", name: "Pratap Nagar – Khamla Link", from: "J37", to: "J38", lanes: 3, highway: false, capacity: 3600 },
  { id: "C56", name: "Pratap Nagar – Trimurti Nagar Ring Rd", from: "J37", to: "J39", lanes: 4, highway: true, capacity: 5400 },
  { id: "C57", name: "Mate Chowk – Trimurti Nagar Connector", from: "J26", to: "J39", lanes: 3, highway: false, capacity: 3700 },
  { id: "C58", name: "Trimurti Nagar – Hingna MIDC T-Point", from: "J39", to: "J51", lanes: 4, highway: true, capacity: 5600 },
  { id: "C59", name: "Wadi Highway – MIDC Hingna Outer Bypass", from: "J49", to: "J51", lanes: 4, highway: true, capacity: 5200 },

  // --- South Radial, Manish Nagar & Airport ---
  { id: "C60", name: "Narendra Nagar – Manish Nagar Underpass", from: "J36", to: "J40", lanes: 3, highway: false, capacity: 4600 },
  { id: "C61", name: "Khamla – Somalwada Wardha Rd", from: "J38", to: "J41", lanes: 3, highway: false, capacity: 4000 },
  { id: "C62", name: "Somalwada – Manish Nagar Cross Link", from: "J41", to: "J40", lanes: 3, highway: false, capacity: 3900 },
  { id: "C63", name: "Somalwada – MIHAN AIIMS Wardha Express", from: "J41", to: "J50", lanes: 4, highway: true, capacity: 6800 },
  { id: "C64", name: "Manish Nagar – Besa Ghogli Arterial", from: "J40", to: "J52", lanes: 3, highway: false, capacity: 4100 },
  { id: "C65", name: "Besa – MIHAN Khapri Outer Spine", from: "J52", to: "J50", lanes: 3, highway: false, capacity: 3800 },

  // --- South-East, Nandanvan & Wathoda ---
  { id: "C66", name: "Medical Sq – Krida Chowk Tukdoji Spine", from: "J28", to: "J31", lanes: 3, highway: false, capacity: 4400 },
  { id: "C67", name: "Krida Chowk – Reshimbagh Suresh Bhat", from: "J31", to: "J34", lanes: 3, highway: false, capacity: 3600 },
  { id: "C68", name: "Medical Sq – Reshimbagh Direct Link", from: "J28", to: "J34", lanes: 2, highway: false, capacity: 3100 },
  { id: "C69", name: "Baidyanath – Nandanvan Main Road", from: "J29", to: "J33", lanes: 3, highway: false, capacity: 4200 },
  { id: "C70", name: "Nandanvan – Telephone Exchange Link", from: "J33", to: "J32", lanes: 3, highway: false, capacity: 3800 },
  { id: "C71", name: "Nandanvan – Krida Chowk Connector", from: "J33", to: "J31", lanes: 2, highway: false, capacity: 3000 },
  { id: "C72", name: "Nandanvan – Wathoda Ring Road Spine", from: "J33", to: "J44", lanes: 4, highway: true, capacity: 5500 },
  { id: "C73", name: "Reshimbagh – Wathoda Express Link", from: "J34", to: "J44", lanes: 3, highway: false, capacity: 4100 },
  { id: "C74", name: "Wathoda – Pardi Bhandara Rd Ring Rd", from: "J44", to: "J43", lanes: 4, highway: true, capacity: 6000 },
];

export const junctionById = (id: string) => JUNCTIONS.find((j) => j.id === id);

export function neighbours(id: string): string[] {
  const out = new Set<string>();
  for (const c of CORRIDORS) {
    if (c.from === id) out.add(c.to);
    if (c.to === id) out.add(c.from);
  }
  return [...out];
}

/** Internal Ward Coverage Check: counts plotted junctions per NMC ward */
export function getWardCoverageReport() {
  const wardMap = new Map<string, Junction[]>();
  for (const w of NMC_WARDS) {
    wardMap.set(w.name, []);
  }

  for (const j of JUNCTIONS) {
    const list = wardMap.get(j.ward);
    if (list) {
      list.push(j);
    } else {
      wardMap.set(j.ward, [j]);
    }
  }

  const reports = NMC_WARDS.map((w) => {
    const plotted = wardMap.get(w.name) ?? [];
    const count = plotted.length;
    const isComplete = count >= w.targetCount;
    const isZero = count === 0;
    return {
      wardId: w.id,
      wardName: w.name,
      target: w.targetCount,
      plotted: count,
      isComplete,
      isZero,
      junctions: plotted,
      description: w.description,
    };
  });

  const totalPlotted = JUNCTIONS.length;
  const totalTarget = NMC_WARDS.reduce((s, w) => s + w.targetCount, 0);
  const zeroWards = reports.filter((r) => r.isZero);
  const coveragePercent = Math.min(100, Math.round((totalPlotted / totalTarget) * 100));

  return {
    totalPlotted,
    totalTarget,
    coveragePercent,
    zeroWardsCount: zeroWards.length,
    isFullyCovered: zeroWards.length === 0,
    wardBreakdown: reports,
  };
}

/* ---------------------------------------------------------------- Demand & Simulation */

export const PRESETS = {
  morning: { label: "Morning peak (9 AM–12 PM)", start: 9, end: 12 },
  evening: { label: "Evening peak (4 PM–7 PM)", start: 16, end: 19 },
  afternoon: { label: "Afternoon lull (1 PM–3 PM)", start: 13, end: 15 },
  night: { label: "Night quiet (9 PM–11 PM)", start: 21, end: 23 },
} as const;

export type DayKey = "weekday" | "saturday" | "sunday";
export type Weather = "clear" | "rain" | "fog";
export type VehicleMix = "all" | "cars" | "twowheeler" | "freight" | "transit";

export interface SimInput {
  start: number; // hour, e.g. 9
  end: number;
  day: DayKey;
  weather: Weather;
  vehicles: VehicleMix;
  greenOverrides: Record<string, number>;
  closedCorridors: string[];
  divert?: { from: Zone; to: Zone; pct: number } | null;
}

const DAY_FACTOR: Record<DayKey, number> = { weekday: 1, saturday: 0.82, sunday: 0.62 };
const WEATHER_FACTOR: Record<Weather, number> = { clear: 1, rain: 1.22, fog: 1.35 };
const VEHICLE_FACTOR: Record<VehicleMix, number> = {
  all: 1,
  cars: 0.65,
  twowheeler: 0.28,
  freight: 0.16,
  transit: 0.1,
};

/** Is the current time inside Nagpur peak windows (9-12 AM or 4-7 PM) */
export function isPeakWindow(hour: number) {
  return (hour >= 9 && hour < 12) || (hour >= 16 && hour < 19);
}

/** Peak intensity curve across a 24h clock for Nagpur traffic */
export function hourIntensity(hour: number) {
  const m = Math.exp(-(((hour - 10.3) / 1.7) ** 2));
  const e = Math.exp(-(((hour - 17.8) / 1.8) ** 2));
  return 0.38 + 0.76 * m + 0.88 * e;
}

export interface JunctionResult {
  id: string;
  green: number;
  congestion: number; // 0-1
  waitSeconds: number;
  throughput: number; // veh/h
  queue: number;
}

export interface CorridorResult {
  id: string;
  load: number; // 0-1+
  speedKph: number;
  volume: number;
  durationInTrafficMinutes: number;
  freeFlowDurationMinutes: number;
  trafficRatio: number; // duration_in_traffic / free_flow
}

export interface SimResult {
  junctions: Record<string, JunctionResult>;
  corridors: Record<string, CorridorResult>;
  avgWait: number;
  congestionIndex: number;
  throughput: number;
  isPeak: boolean;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

/** Deterministic core model for full 52+ Nagpur network. `plan` = "base" or "rebalanced". */
export function simulate(input: SimInput, plan: "base" | "rebalanced"): SimResult {
  const hours = Math.max(0.5, input.end - input.start);
  let intensity = 0;
  for (let h = input.start; h < input.end; h += 0.25) intensity += hourIntensity(h) * 0.25;
  intensity /= hours;

  const isPeak = isPeakWindow((input.start + input.end) / 2);

  const global =
    intensity *
    DAY_FACTOR[input.day] *
    WEATHER_FACTOR[input.weather] *
    VEHICLE_FACTOR[input.vehicles];

  // zone demand shifts from a "what-if" diversion
  const zoneShift: Partial<Record<Zone, number>> = {};
  if (input.divert && input.divert.pct > 0) {
    zoneShift[input.divert.from] = -input.divert.pct / 100;
    zoneShift[input.divert.to] = input.divert.pct / 100;
  }

  const closed = new Set(input.closedCorridors);

  // extra demand pushed onto neighbours of a closed corridor
  const spill: Record<string, number> = {};
  for (const c of CORRIDORS) {
    if (!closed.has(c.id)) continue;
    for (const n of [...neighbours(c.from), ...neighbours(c.to), c.from, c.to]) {
      spill[n] = (spill[n] ?? 0) + 0.12;
    }
  }

  const junctions: Record<string, JunctionResult> = {};
  for (const j of JUNCTIONS) {
    const shift = zoneShift[j.zone] ?? 0;
    const demand = j.demand * global * (1 + shift) * (1 + (spill[j.id] ?? 0));

    let green = input.greenOverrides[j.id] ?? j.baseGreen;
    if (plan === "rebalanced") {
      // proportional-to-demand reallocation, bounded to realistic phase lengths
      const target = clamp(j.baseGreen * (0.75 + 0.52 * demand), 15, 90);
      green = clamp((green + target * 2) / 3, 15, 90);
    }

    const cycle = 110;
    const capacityShare = green / cycle;
    const saturation = demand / (capacityShare * 2.15);
    const congestion = clamp(saturation / 1.62, 0.04, 1);
    // Webster delay approximation
    const wait = clamp(
      (cycle * (1 - capacityShare) ** 2) / (2 * (1 - Math.min(0.96, saturation * 0.55))) +
        congestion * 26,
      6,
      190,
    );
    const throughput = Math.round(1950 * capacityShare * clamp(1.65 - congestion, 0.35, 1.3) * 2.1);
    junctions[j.id] = {
      id: j.id,
      green: Math.round(green),
      congestion,
      waitSeconds: Math.round(wait),
      throughput,
      queue: Math.round(congestion * demand * 48),
    };
  }

  const corridors: Record<string, CorridorResult> = {};
  for (const c of CORRIDORS) {
    if (closed.has(c.id)) {
      corridors[c.id] = {
        id: c.id,
        load: 0,
        speedKph: 0,
        volume: 0,
        durationInTrafficMinutes: 0,
        freeFlowDurationMinutes: 0,
        trafficRatio: 1,
      };
      continue;
    }
    const a = junctions[c.from] ?? { congestion: 0.3 };
    const b = junctions[c.to] ?? { congestion: 0.3 };
    const load = clamp((a.congestion + b.congestion) / 2 + (c.highway ? -0.06 : 0.04), 0.03, 1.25);
    const free = c.highway ? 75 : 45;
    const speedKph = Math.round(clamp(free * (1 - 0.72 * load), 6, free));
    const volume = Math.round(c.capacity * clamp(load * 0.95, 0.05, 0.98));

    const fromJ = junctionById(c.from);
    const toJ = junctionById(c.to);
    const distKm = fromJ && toJ ? getDistanceKm(fromJ, toJ) : 1.5;
    const freeFlowDuration = (distKm / free) * 60;
    const durationInTraffic = (distKm / Math.max(6, speedKph)) * 60;
    const trafficRatio = durationInTraffic / Math.max(0.1, freeFlowDuration);

    corridors[c.id] = {
      id: c.id,
      load,
      speedKph,
      volume,
      durationInTrafficMinutes: Number(durationInTraffic.toFixed(1)),
      freeFlowDurationMinutes: Number(freeFlowDuration.toFixed(1)),
      trafficRatio: Number(trafficRatio.toFixed(2)),
    };
  }

  const list = Object.values(junctions);
  return {
    junctions,
    corridors,
    avgWait: list.reduce((s, j) => s + j.waitSeconds, 0) / list.length,
    congestionIndex: list.reduce((s, j) => s + j.congestion, 0) / list.length,
    throughput: list.reduce((s, j) => s + j.throughput, 0),
    isPeak,
  };
}

export function defaultSimInput(preset: keyof typeof PRESETS = "morning"): SimInput {
  return {
    start: PRESETS[preset].start,
    end: PRESETS[preset].end,
    day: "weekday",
    weather: "clear",
    vehicles: "all",
    greenOverrides: {},
    closedCorridors: [],
    divert: null,
  };
}

/** 7-day historical trend for a junction */
export function historyFor(id: string, hour: number) {
  const seed = [...id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return Array.from({ length: 14 }, (_, i) => {
    const h = 6 + i;
    const wobble = ((Math.sin(seed * 0.7 + i * 1.3) + 1) / 2) * 0.18;
    const v = hourIntensity(h) * 0.55 + wobble;
    return {
      hour: `${String(h).padStart(2, "0")}:00`,
      congestion: Math.round(clamp(v, 0.05, 1) * 100),
      current: h === Math.floor(hour),
    };
  });
}

export function congestionTone(c: number) {
  if (c >= 0.75) return "critical" as const;
  if (c >= 0.5) return "peak" as const;
  return "flow" as const;
}

export function fmtWait(seconds: number) {
  return `${Math.round(seconds)}s`;
}

export function getDistanceKm(
  a: { lat: number; lng: number } | { x: number; y: number },
  b: { lat: number; lng: number } | { x: number; y: number },
) {
  if ("lat" in a && "lat" in b) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sa =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
    return Math.max(0.2, R * c);
  }
  if ("x" in a && "x" in b) {
    return Math.hypot(a.x - b.x, a.y - b.y) * 0.22;
  }
  return 1;
}

export function gpsToMapPercent(lat: number, lng: number): { x: number; y: number } {
  const { minLat, maxLat, minLng, maxLng } = NAGPUR_BOUNDS;
  const x = Math.max(0, Math.min(100, ((lng - minLng) / (maxLng - minLng)) * 100));
  const y = Math.max(0, Math.min(100, ((maxLat - lat) / (maxLat - minLat)) * 100));
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

export function mapPercentToGps(x: number, y: number): { lat: number; lng: number } {
  const { minLat, maxLat, minLng, maxLng } = NAGPUR_BOUNDS;
  const lng = minLng + (x / 100) * (maxLng - minLng);
  const lat = maxLat - (y / 100) * (maxLat - minLat);
  return { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
}

/** Dijkstra over full 75+ corridors weighted by live travel time */
export function fastestRoute(
  from: string,
  to: string,
  result: SimResult,
  blocked: string[] = [],
): { path: string[]; minutes: number; distanceKm: number } {
  const blockedSet = new Set(blocked);
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set(JUNCTIONS.map((j) => j.id));
  for (const j of JUNCTIONS) dist[j.id] = Infinity;
  dist[from] = 0;

  while (unvisited.size) {
    let cur: string | null = null;
    for (const id of unvisited) if (cur === null || dist[id]! < dist[cur]!) cur = id;
    if (cur === null || dist[cur] === Infinity) break;
    unvisited.delete(cur);
    if (cur === to) break;
    for (const c of CORRIDORS) {
      if (blockedSet.has(c.id)) continue;
      const other = c.from === cur ? c.to : c.to === cur ? c.from : null;
      if (!other || !unvisited.has(other)) continue;
      const a = junctionById(c.from);
      const b = junctionById(c.to);
      if (!a || !b) continue;
      const km = getDistanceKm(a, b);
      const speed = Math.max(6, result.corridors[c.id]?.speedKph ?? 30);
      const cost = (km / speed) * 60 + (result.junctions[other]?.waitSeconds ?? 30) / 60;
      if (dist[cur]! + cost < dist[other]!) {
        dist[other] = dist[cur]! + cost;
        prev[other] = cur;
      }
    }
  }

  const path: string[] = [];
  let node: string | null = to;
  while (node) {
    path.unshift(node);
    node = prev[node] ?? null;
  }

  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = junctionById(path[i]!);
    const b = junctionById(path[i + 1]!);
    if (a && b) totalDistance += getDistanceKm(a, b);
  }

  return {
    path: path[0] === from ? path : [],
    minutes: dist[to] === Infinity ? 0 : dist[to]!,
    distanceKm: Number(totalDistance.toFixed(1)),
  };
}

export function corridorBetween(a: string, b: string) {
  return CORRIDORS.find(
    (c) => (c.from === a && c.to === b) || (c.from === b && c.to === a),
  );
}


