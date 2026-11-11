// server.ts
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server as SocketIOServer } from "socket.io";
import { WebSocket, WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import * as TikTokConnector from "tiktok-live-connector";

// src/server/wordlist.ts
var TrieNode = class {
  constructor() {
    this.children = /* @__PURE__ */ new Map();
    this.isWord = false;
  }
};
var Trie = class {
  constructor() {
    this.root = new TrieNode();
    this.wordCount = 0;
  }
  insert(word) {
    const clean = word.trim().toLowerCase();
    if (!clean || !/^[a-z]+$/.test(clean)) return;
    let node = this.root;
    for (const ch of clean) {
      let next = node.children.get(ch);
      if (!next) {
        next = new TrieNode();
        node.children.set(ch, next);
      }
      node = next;
    }
    if (!node.isWord) {
      node.isWord = true;
      this.wordCount++;
    }
  }
  has(word) {
    let node = this.root;
    for (const ch of word) {
      const next = node.children.get(ch);
      if (!next) return false;
      node = next;
    }
    return node.isWord;
  }
  hasPrefix(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      const next = node.children.get(ch);
      if (!next) return false;
      node = next;
    }
    return true;
  }
};
var STOPLIST = /* @__PURE__ */ new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "has",
  "have",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "shall",
  "should",
  "can",
  "could",
  "may",
  "might",
  "must",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "they",
  "them",
  "their",
  "there",
  "here",
  "he",
  "she",
  "we",
  "you",
  "your",
  "his",
  "her",
  "him",
  "me",
  "my",
  "our",
  "who",
  "whom",
  "whose",
  "which",
  "what",
  "when",
  "where",
  "why",
  "how",
  "not",
  "no",
  "so",
  "than",
  "too",
  "very",
  "just",
  "also",
  "such",
  "into",
  "from",
  "about",
  "after",
  "before",
  "over",
  "under",
  "between",
  "through",
  "during",
  "while",
  "because",
  "although",
  "though",
  "since",
  "until",
  "one",
  "two",
  "three",
  "first",
  "second",
  "new",
  "old",
  "other",
  "some",
  "any",
  "all",
  "each",
  "every",
  "most",
  "many",
  "much",
  "more",
  "less",
  "few",
  "several",
  "both",
  "either",
  "neither"
]);
var COMMON_WORDS_RAW = `
time year people way day man thing woman life child world school state family student group country problem hand part place case week company system program question work government number night point home water room mother area money story fact month lot right study book eye job word business issue side kind head house service friend father power hour game line end member law car city community name president team minute idea kid body information back parent face others level office door health person art war history party result change morning reason research girl guy moment air teacher force education foot boy age policy process music market sense serviceplan college interest death experience effect use class control care field development role effort rate heart drug show leader light voice wife police mind price report decision son view relationship town road arm difference value building action model season society tax director position player agree record paper space ground form event official matter center couple site project hit base activity star table need court produce eat teach oil sytuations cost industry figure street image phone data picture practice piece land product doctor wall patient worker news test movie north love support technology step baby computer type attention film tree source organization choose look century evidence window difficult listen cultureillion plan \u0986\u099A\u09B0\u09A3
able acid aged also area army away baby back ball band bank base bath bear beat bell belt best bill bird blow blue boat body bomb bond bone book boom\u679A boot born boss both bowl bulk burn bush busy call calm came camp card care Carl case cash cast cell chat chip city clad claim clay clean clear club coal coat code cold come cook cool cope copy core cost crew crop dark data date dawn days dead deal dean dear debt deep deny desk dial dick diet disc disk does done door dose down draw drew drop drug dual duke dust duty each earn ease east easy edge else even ever evil exit face fact fail fair fall farm fast fate fear feed feel feet fell felt file fill film find fine fire firm fish five flat fled flew flowfood foot ford form fort four free from fuel full fund gain game gate gave gear gene gift girl give glad goal goes gold golf gone good gray grew grey grow gulf hair half hall hand hang hard harm hate have head hear heat held hell help here hero high hill hire hold hole holy home hope horn host hour huge hung hunt hurt idea inch into iron item jack jane jean john join jump jury just keen keep kent kept kick kill kind king knee knew know lack lady laid lake land lane last late lead left less life lift like line link list live load loan lock logo long look lord lose loss lost loud love luck made mail main make male mall many mark mass matt meal mean meat meet menu mere mess Emi mile milk mill mind mine miss mode mood moon more most move much must name navy near neck need news next nice nick nine none norm nose note okay once only onto open oral area
planet star galaxy orbit solar lunar eclipse comet asteroid meteor nebula cosmos gravity telescope rocket satellite launch shuttle station astronaut module probe crater surface atmosphere oxygen carbon nitrogen hydrogen heliumiron nickel copper silver gold metal crystal mineral rock stone magma lava volcano earthquake fault plate tectonic ocean sea wave tide current reef island coast shore beach sand cliff canyon valley river stream lake pond glacier ice snow rain cloud storm wind hurricane tornado climate weather season spring summer autumn winter forest woods jungle desert tundra meadow prairie savanna plant tree leaf root bark trunk branch seed flower petal pollen grass moss fern fungus mushroom animal mammal reptile amphibian bird insect spider fish shark whale dolphin seal otter bear wolf fox deer lion tiger leopard cheetah elephant rhino hippo giraffe zebra horse donkey camel sheep goat pig cow bull dog cat mouse rat squirrel rabbit hare bat eagle hawk owl falcon parrot penguin swan duck goose frog toad snake lizard turtle crocodile alligator crab lobster shrimp octopus squid snail worm bee wasp ant butterfly moth beetle fly mosquito
science physics chemistry biology astronomy geology ecology genetics evolution anatomy medicine surgery vaccine virus bacteria cell tissue organ brain heart lung liver kidney stomach muscle bone nerve blood artery vein artery hormone enzyme protein vitamin mineral calorie nutrient diet exercise fitness sport game match tournament league champion medal trophy score goal point pass shot kick throw catch run jump swim dive cycle race track court field stadium arena gym pool coach referee fan crowd team club player captain uniform helmet glove boot racket bat ball net post ring bell whistle clock timer watch calendar schedule planner journal diary letter note page chapter volume library archive museum gallery theater cinema stage screen actor actress director producer writer author poet artist painter sculptor composer musician singer dancer orchestra band choir symphony concert opera ballet drama comedy tragedy novel poem essay article review biography history legend myth folklore tradition custom culture language dialect alphabet grammar vocabulary dictionary encyclopedia translation
`.trim().split(/\s+/);
var RARE_WORDS_RAW = `
alchemy archive artifact asteroid aurora basilica biosphere broccoli calligraphy catapult cathedral centrifuge chronicle citadel clarinet Cobalt coliseum compass concerto conduit constellation corridor crucible cryptogram curvature cylinder cypress labyrinth latitude longitude magnetism manuscript marathon mechanism meridian metaphor meteorite microbes millennium mineralogy monolith\u5B63 monument mosaic nebula obsidian odometerelisk orchestra origami paradigm paradox parchment pavilion pendulum peninsula pergola permafrost petroglyph phenomenon phoneme photon pinnacle plankton plateau polarity porcelain portcullis positron precipice predator prelude prism prodigy prophecy protocol pulsar pyramid quadrant quarantineasar quaternion quicksilver quintessence radiation barometer biosphere boulevard cartography catalyst cavern celestial chameleon chandelier charisma chronicleinnamon cipher cloister coalescent cobblestone colloquium combustion compendium concentric confluence conservatory contagion continuum contraband conundrum convection copernican corollary cosmogony cosmology counterweight cratered crescendo crystalline culinary curvature cybernetic cyclotron
archipelago bioluminescence luminescence photosynthesis chemosynthesis metamorphosis symbiosis osmosis diffusion refraction diffraction interference polarization spectroscopy chromatography electrophoresis centrifugation distillation calcination sublimation condensation evaporation precipitation crystallization polymerization fermentation pasteurization sterilization immunization vaccination inoculation gestation hibernation estivation migration echolocation navigation triangulation radiolarian foraminifera stromatolite trilobite ammonite archaeopteryx megalodon mastodon mammoth sabertooth Neanderthal Paleolithic Mesolithic Neolithic Bronze Iron Antiquity Medieval Renaissance Enlightenment Industrial Modern Postmodern Romanticism Impressionism Expressionism Cubism Surrealism Futurism Minimalism Brutalism Baroque Rococo Gothic Neoclassical Byzantine Romanesque Ottoman Mughal Ming Qing Tokugawa Meiji Hellenistic Ptolemaic Seleucid Maurya Gupta Abbasid Umayyad Fatimid Mamluk Safavid Timurid Carolingian Merovingian Plantagenet Tudor Stuart Habsburg Romanov Bourbon
`.trim().split(/\s+/);
var ULTRA_WORDS_RAW = `
abiogenesis archaeoastronomy bathyscaphe birefringence biostratigraphy chromatophore chronolect circumvallation clathrate coccolithophore cryovolcanism dendrochronology \u0434\u0438\u0430\u0433\u0435\u043D\u0435\u0437 eigenstate electroreception endosymbiosis epiphenomenon estremophile euchromatin exobiology ferromagnetism fluorophore geochronology glottochronology gravitropism halophile heliophysics hemocyanin heterochromatin hydrostatics hyperfine ichnology ignimbrite interferometry isostasy karyotype kymograph libration lithification magnetosphere mechanoreception megafauna magnetohydrodynamics metasomatism microgravity \u043C\u0456\u043C\u0435\u0441\u0438\u0441 morphogen mycorrhiza nucleosynthesis oceanography odontocete olfaction ommatidium ontogeny ophiolite organogenesis paleoclimatology paleomagnetism palynology panspermia parsec pathognomonic pedogenesis perihelion petrology piezoelectrics planimal plasmonics pleiotropy pneumatophore poikilotherm polynyas protostar pyroclastic radiolaria regolith rheology SapirWhorf seismology selenography sericulture solifluction sonoluminescence spallation speleology stoichiometrics stratigraphy stromatolites superfluidity synapomorphy taphonomy technosignature tektite thermocline thermohaline thigmotropism tokamak triboluminescence \u0442\u0440\u043E\u043F\u043E\u0441\u0444\u0435\u0440\u0430 vitrification xenolith zeugma zoogeography
quasar pulsar magnetar blazar neutron baryon lepton boson hadron quark gluon tachyon neutrino graviton antimatter singularity eventhorizon Schwarzschild Hawking Chandrasekhar Oppenheimer Feynman Dirac Schrodinger Heisenberg Planck Maxwell Faraday Ampere Volta Ohm Joule Watt Kelvin Celsius Fahrenheit Rankine Avogadro Boltzmann Doppler Coriolis Foucault Mercator Fibonacci Euclid Pythagoras Archimedes Eratosthenes Hipparchus Ptolemy Copernicus Kepler Galileo Newton Leibniz Euler Gauss Riemann Lobachevsky Poincar\xE9 Hilbert G\xF6del Turing Shannon VonNeumann Lovelace Babbage Boole DeMorgan Venn Bayes Markov MonteCarlo Fourier Laplace Lagrange Legendre Bessel Chebyshev Hermite Hyperbola Parabola Ellipse Cycloid Epicycloid Catenary Brachistochrone Tautochrone KleinMoebius Torus Polyhedron Tetrahedron Octahedron Dodecahedron Icosahedron Tesseract Simplex Manifold Topology Homology Cohomology Homotopy Isomorphism Homeomorphism Diffeomorphism Automorphism Endomorphism Epimorphism Monomorphism Functor Monad Groupoid Semigroup Monoid Quasigroup Loop Ring Field Module Vector Tensor Spinor Bivector Multivector Clifford Grassmann LieAlgebra
`.trim().split(/\s+/);
var GRID_CORE_WORDS = `
ace act add age ago aid aim air ale all amp and ant any ape apt arc are ark arm art ash ask ate awe axe
bad bag ban bar bat bay bed bee beg bet bid big bin bit\u5951 bow box boy bra bud bug bum bun bus but buy
cab cad cam can cap car cat caw cay cel cep chi cid cig cis cob cod cog col con coo cop cor cos cot cow cox coy coz cub cud cue cup cur cut
dab dad dag dah dak dal dam dan dap daw day deb dee def del den dev dew dex dey dib did die dif dig dim din dip dis dit div doc doe dog dol dom don doo dop dor dos dot dow dry dub dud due dug duh dui dun duo dup dye
ear eat ebb eco eds eel eff efs eft egg ego eke eld elf elk ell elm els eme ems emu end eng ens eon era ere erg ern err ers ess eta eth eve ewe eye
fab fad fag fan far fas fat fax fay fed fee feh fem fen fer fes fet feu few fey fez fib fid fie fig fil fin fir fit fix fiz flu fly fob foe fog foh fon fop for fou fox foy fro fry fub fud fug fum fun fur
gab gad gae gag gal gam gan gap gar gas gat gay ged gee gel gem gen get gey ghi gib gid gie gig gin gip gis git gnu goa gob god goo gor gos got gox goy gul gum gun gut guv guy gym gyp
had hae hag hah haj ham hao hap has hat haw hay heh hem hen hep her hes het hew hex hey hic hid hie him hin hip his hit hmm hob hod hoe hog hon hop hos hot how hoy hub hue hug huh hum hun hup hut hyp
ice ich ick icy ids iff ifs igg ilk ill imp ink inn ins ion ire irk ism its ivy
jab jag jam jar jaw jay jee jet jeu jew jib jig jin job joe jog jot jow joy jug jun jus jut
kab kae kaf kas kat kay kea kef keg ken kep kex key khi kid kif kin kip kir kis kit koa kob koi kop kor kos kue kye
lab lac lad lag lah lam lap lar las lat lav law lax lay lea led lee leg lei lek Let leu lev lex ley lib lid lie lin lip lis lit lob log loo lop lor lot low lox lug lum luv lux lye
mac mad mae mag man map mar mas mat maw max may med meg mel mem men met mew mho mib mic mid mig mil mim mir mis mix moa mob moc mod moe mog moi mol mom mon moo mop mor mos mot mow mud mug mum mun mus mut myc
nab nae nag nah nam nan nap naw nay neb nee net new nib nil nim nip nit nix nob nod nog noh nom noo nor nos not now nth nub nug nun nus nut
oaf oak oar oat oba obe obi oca oda odd ode ods oes off oft ohm oho ohs oil oka oke old ole oms one ono ons ooh oot ope ops opt ora orb orc ore ors ort ose oud our out ova owe owl own oxo oxy
pac pad pah pal pam pan pap par pas pat paw pax pay pea pec ped pee peg peh pen pep per pes pet pew phi pht pia pic pie pig pin pip pis pit piu pix ply pod poh poi pol pom poo pop pot pow pox pro pry psi pub pud pug pul pun pup pur pus put pya pye pyx
qat qis qua
rad rag rah rai raj ram ran rap ras rat raw rax ray reb rec red ree ref reg rei rem rep res ret rev rex rho ria rib rid rif rig rim rin rip rob roc rod roe rom roo rot row rub rue rug rum run rut rya rye
sab sac sad sae sag sal sap sat sau saw sax say sea sec see seg sei sel sen ser set sew sex sha she shh shy sib sic sim sin sip sir sis sit six ska ski sky sly sob sod sogoh sol som son sop sos sot sou sow sox soy spa spy sri sty sub sud sue suk sum sun sup suq syn
tab tad tae tag taj tam tan tao tap tar tas tat tau tav taw tax tea ted tee teg tel ten tet tew the tho thy tic tie til tin tip tis tit tod toe tog tom ton too top tor tot tow toy try tsk tub tug tui tum tun tup tut tux twa two tye
udo ugh uke ulu umm ump uns upo ups urb urd urn urp use uta ute uts
vac van var vas vat vau vav vaw vee veg vet vex via vid vie vig vim vin vis voe vow vox vug vum
wab wad wae wag wan wap war was wat waw wax way web wed wee wen wet wha who why wig win wis wit wiz woe wog wok won woo wop wos wot wow wry wud wye wyn
xis
yad yah yak yam yap yar yaw yay yea yeh yen yep yes yet yew yid yin yip yob yod yok yom yon you yow yuk yum yup
zag zap zas zax zed zee zek zep zig zin zip zit zoa zoo zuz zzz
starters starling stardom starlight starlit starlet stargaze Starship
planetarium planetary planchette
galaxies galactic
scientist scientific sciences
historian historical histories
mountainous mountaineer mountains
oceanic oceanographer oceans
architecture architectural architect
philosopher philosophical philosophy
literature literary literal
electrical electricity electron electronics
magnetic magnetism magnetometer
chemical chemist chemicals
biological biologist organism organisms
astronomer astronomical astrophysics
geological geologist geography geographic
democracy democratic republic constitutional
revolution revolutionary evolutionary
civilization civilized ancient classical medieval
instrument instrumental orchestra symphony musical composer
paintings painter sculpture sculptor artistic gallery museum
discovery discoveries invention inventor laboratory experiment
atmosphere atmospheric climate weather tropical arctic antarctic
continent continental peninsula archipelago islander
mediterranean atlantic pacific caribbean himalayan amazonian
emperor empress empire kingdom dynasty monarch monarchy parliament
cathedral monastery temple sanctuary pyramid monument ruin
railroad railway locomotive steamship aviation aircraft spacecraft
telegraph telephone television broadcast satellite wireless network
algorithm computer software hardware processor database encryption
`.trim().split(/\s+/);
var CURATED_WIKI_ARTICLES = [
  // Halloween & Late October Curated Articles
  {
    title: "Carved Jack Lantern Pumpkin",
    category: "Halloween & Folklore",
    seasonTag: "halloween",
    extract: "A jack-o-lantern is a carved lantern, most commonly made from a pumpkin, turnip, or rutabaga, associated with the holiday of Halloween. Originating in Irish and Scottish folklore surrounding the legend of Stingy Jack and wandering spectral lights, carved pumpkins glow on doorsteps every October.",
    url: "https://en.wikipedia.org/wiki/Jack-o%27-lantern",
    titleWords: ["carved", "jack", "lantern", "pumpkin"],
    keywords: ["halloween", "autumn", "candle", "flame", "night", "ghost", "spirit", "carve", "seed", "orange", "gourd", "harvest", "october", "light", "dark", "mask", "treat", "folklore", "myth", "glow"]
  },
  {
    title: "Ancient Celtic Samhain Festival",
    category: "Halloween & History",
    seasonTag: "halloween",
    extract: "Samhain is a Gaelic seasonal festival observed from sunset on October 31 to November 1, marking the end of the harvest season and the beginning of winter. In Celtic tradition, the boundary between this world and the Otherworld thinned at Samhain, inspiring bonfires, guising, and modern Halloween customs.",
    url: "https://en.wikipedia.org/wiki/Samhain",
    titleWords: ["ancient", "celtic", "samhain", "festival"],
    keywords: ["harvest", "winter", "autumn", "fire", "bonfire", "feast", "spirit", "ghost", "mask", "costume", "apple", "nut", "night", "october", "custom", "folk", "hearth", "hill", "flame", "dark"]
  },
  {
    title: "Gothic Vampire Folklore Legend",
    category: "Folklore & Literature",
    seasonTag: "halloween",
    extract: "A vampire is a mythical creature in folklore that subsists by feeding on the vital essence of the living. Popularized in Gothic fiction by John Polidori and Bram Stoker classic novel Dracula, vampire legends blend Eastern European superstition with Victorian nocturnal mystery.",
    url: "https://en.wikipedia.org/wiki/Vampire",
    titleWords: ["gothic", "vampire", "folklore", "legend"],
    keywords: ["night", "castle", "bat", "shadow", "fang", "cape", "blood", "moon", "grave", "crypt", "coffins", "garlic", "silver", "mirror", "myth", "novel", "dark", "count", "mist", "sleep"]
  },
  {
    title: "Sleepy Hollow Headless Horseman",
    category: "Autumn Folklore & Tales",
    seasonTag: "halloween",
    extract: "The Legend of Sleepy Hollow by Washington Irving tells the story of schoolmaster Ichabod Crane and his midnight encounter with the Headless Horseman, a ghostly Hessian trooper said to ride through the autumn woods in search of his missing head.",
    url: "https://en.wikipedia.org/wiki/The_Legend_of_Sleepy_Hollow",
    titleWords: ["sleepy", "hollow", "headless", "horseman"],
    keywords: ["horse", "rider", "bridge", "woods", "forest", "night", "pumpkin", "ghost", "tale", "legend", "autumn", "valley", "church", "moon", "shadow", "lantern", "chase", "fear", "folklore", "story"]
  },
  // Christmas & Winter Curated Articles
  {
    title: "Evergreen Christmas Tree Tradition",
    category: "Christmas & Winter",
    seasonTag: "christmas",
    extract: "A Christmas tree is a decorated tree, usually an evergreen conifer such as a spruce, pine, or fir, associated with the celebration of Christmas. Originating in Renaissance Germany, trees are illuminated with fairy lights, glass baubles, tinsel, and a shining star or angel at the crown.",
    url: "https://en.wikipedia.org/wiki/Christmas_tree",
    titleWords: ["evergreen", "christmas", "tree", "tradition"],
    keywords: ["pine", "spruce", "fir", "branch", "needle", "star", "angel", "light", "tinsel", "gift", "snow", "winter", "carol", "wreath", "holly", "candle", "green", "gold", "red", "feast"]
  },
  {
    title: "Arctic Reindeer Winter Sleigh",
    category: "Winter & Holiday Lore",
    seasonTag: "christmas",
    extract: "In festive folklore, Santa Claus rides a magical flying sleigh pulled by reindeer across the Christmas Eve sky to deliver gifts. Real Arctic reindeer are remarkably adapted to polar winters with hollow insulating fur, wide hooves for snow, and ultraviolet vision.",
    url: "https://en.wikipedia.org/wiki/Santa_Claus%27s_reindeer",
    titleWords: ["arctic", "reindeer", "winter", "sleigh"],
    keywords: ["snow", "ice", "north", "pole", "bell", "roof", "chimney", "gift", "toy", "sack", "antler", "herd", "tundra", "frost", "cold", "night", "star", "flight", "magic", "carol"]
  },
  // Easter & Spring Curated Articles
  {
    title: "Decorated Painted Easter Eggs",
    category: "Easter & Springtime",
    seasonTag: "easter",
    extract: "Easter eggs are decorated eggs given to celebrate Easter and the arrival of springtime. Across cultures, traditions range from intricately wax-resisted Ukrainian pysanky and Imperial Faberge jeweled eggs to chocolate eggs hidden in garden hunts by the Easter Bunny.",
    url: "https://en.wikipedia.org/wiki/Easter_egg",
    titleWords: ["decorated", "painted", "easter", "eggs"],
    keywords: ["spring", "basket", "rabbit", "bunny", "hunt", "garden", "flower", "lily", "tulip", "candy", "shell", "paint", "dye", "color", "gold", "ribbon", "chick", "nest", "grass", "feast"]
  },
  // General Encyclopedic Articles
  {
    title: "Solar Eclipse Phenomenon",
    category: "Astronomy & Space",
    seasonTag: "general",
    extract: "A solar eclipse occurs when the Moon passes between Earth and the Sun, obscuring the view of the Sun from a small part of the Earth, either totally or partially. During totality, the solar corona shimmers in the darkened sky while diamond ring effects appear along the lunar limb.",
    url: "https://en.wikipedia.org/wiki/Solar_eclipse",
    titleWords: ["solar", "eclipse", "phenomenon"],
    keywords: ["moon", "earth", "sun", "shadow", "corona", "orbit", "lunar", "light", "totality", "planet", "sky", "star", "dark", "ring", "phase", "align", "space", "view", "time", "path"]
  },
  {
    title: "Great Barrier Coral Reef",
    category: "Marine Ecology",
    seasonTag: "general",
    extract: "The Great Barrier Reef is the world largest coral reef system composed of over two thousand individual reefs and nine hundred islands stretching across the Coral Sea off the coast of Queensland, Australia. Built by billions of tiny organisms known as coral polyps, it supports extraordinary marine biodiversity.",
    url: "https://en.wikipedia.org/wiki/Great_Barrier_Reef",
    titleWords: ["great", "barrier", "coral", "reef"],
    keywords: ["ocean", "sea", "island", "coast", "water", "marine", "fish", "shark", "whale", "turtle", "sand", "wave", "tide", "shell", "life", "dive", "deep", "blue", "warm", "tropics"]
  },
  {
    title: "Ancient Library of Alexandria",
    category: "Ancient History",
    seasonTag: "general",
    extract: "The Great Library of Alexandria in Egypt was one of the largest and most significant libraries of the ancient world. Functioning as a major center of Hellenistic scholarship under the Ptolemaic dynasty, it housed hundreds of thousands of papyrus scrolls covering mathematics, astronomy, literature, and medicine.",
    url: "https://en.wikipedia.org/wiki/Library_of_Alexandria",
    titleWords: ["ancient", "library", "alexandria"],
    keywords: ["book", "scroll", "egypt", "history", "scholar", "read", "write", "text", "king", "port", "fire", "stone", "hall", "study", "wise", "math", "star", "poet", "greek", "harbor"]
  },
  {
    title: "Northern Aurora Borealis Lights",
    category: "Atmospheric Physics",
    seasonTag: "general",
    extract: "An aurora, often called the northern lights or aurora borealis, is a natural light display in Earth sky predominantly seen in high-latitude regions around the Arctic and Antarctic. Auroras display dynamic curtains, rays, spirals, and flickers caused by solar wind disturbances in the magnetosphere.",
    url: "https://en.wikipedia.org/wiki/Aurora",
    titleWords: ["northern", "aurora", "lights"],
    keywords: ["sky", "night", "glow", "green", "solar", "wind", "pole", "arctic", "ice", "snow", "cold", "star", "field", "storm", "ray", "band", "wave", "atom", "gas", "ion"]
  },
  {
    title: "Monarch Butterfly Migration",
    category: "Entomology & Nature",
    seasonTag: "autumn",
    extract: "Monarch butterfly migration is the phenomenon in which millions of monarch butterflies travel thousands of miles across North America from southern Canada to overwintering mountain forests in central Mexico, navigating by a sun compass and circadian clock.",
    url: "https://en.wikipedia.org/wiki/Monarch_butterfly_migration",
    titleWords: ["monarch", "butterfly", "migration"],
    keywords: ["wing", "flight", "insect", "flower", "plant", "leaf", "tree", "forest", "south", "north", "wind", "sun", "warm", "cold", "orange", "black", "gold", "nest", "egg", "path"]
  },
  {
    title: "Voyager Interstellar Space Probe",
    category: "Space Exploration",
    seasonTag: "general",
    extract: "The Voyager program launched twin robotic probes, Voyager 1 and Voyager 2, to study the outer planets Jupiter, Saturn, Uranus, and Neptune before crossing the heliopause into interstellar space carrying the Golden Record.",
    url: "https://en.wikipedia.org/wiki/Voyager_program",
    titleWords: ["voyager", "space", "probe"],
    keywords: ["star", "planet", "orbit", "moon", "ring", "saturn", "jupiter", "solar", "radio", "signal", "disk", "gold", "record", "earth", "launch", "rocket", "flight", "deep", "craft", "camera"]
  }
];
var cachedTrie = null;
var cachedFreqMap = null;
function getFrequencyMap() {
  if (cachedFreqMap) return cachedFreqMap;
  const map = /* @__PURE__ */ new Map();
  for (const raw of GRID_CORE_WORDS) {
    const w = raw.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (w.length >= 3) map.set(w, 4.6);
  }
  for (const raw of COMMON_WORDS_RAW) {
    const w = raw.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (w.length >= 3) map.set(w, 4.8);
  }
  for (const raw of RARE_WORDS_RAW) {
    const w = raw.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (w.length >= 4) map.set(w, 3.5);
  }
  for (const raw of ULTRA_WORDS_RAW) {
    const w = raw.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (w.length >= 4) map.set(w, 2.3);
  }
  for (const art of CURATED_WIKI_ARTICLES) {
    for (const w of art.titleWords) {
      const clean = w.toLowerCase();
      if (!map.has(clean)) map.set(clean, 3.8);
    }
    for (const w of art.keywords) {
      const clean = w.toLowerCase();
      if (!map.has(clean)) map.set(clean, 4.4);
    }
    const tokens = art.extract.toLowerCase().match(/[a-z]{3,12}/g) || [];
    for (const tok of tokens) {
      if (!map.has(tok)) {
        map.set(tok, tok.length >= 8 ? 2.7 : tok.length >= 6 ? 3.5 : 4.3);
      }
    }
  }
  cachedFreqMap = map;
  return map;
}
function getTrie() {
  if (cachedTrie) return cachedTrie;
  const trie = new Trie();
  const freq = getFrequencyMap();
  for (const word of freq.keys()) {
    trie.insert(word);
  }
  cachedTrie = trie;
  return trie;
}
function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = (h + l - 7 * m + 114) % 31 + 1;
  return { month, day };
}
function getDateSeasonalWikiSlugs(now = /* @__PURE__ */ new Date()) {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();
  const easter = getEasterDate(year);
  const easterMs = new Date(year, easter.month - 1, easter.day).getTime();
  const nowMs = new Date(year, month - 1, day).getTime();
  const daysFromEaster = Math.round((nowMs - easterMs) / (1e3 * 60 * 60 * 24));
  if (daysFromEaster >= -14 && daysFromEaster <= 5) {
    return {
      label: "Easter & Springtime",
      seasonTag: "easter",
      slugs: [
        "Easter_egg",
        "Easter_Bunny",
        "Hot_cross_bun",
        "Faberg\xE9_egg",
        "Paschal_candle",
        "Egg_rolling",
        "Spring_equinox",
        "Tulip_mania",
        "Cherry_blossom",
        "European_hare",
        "Daffodil",
        "Chocolate",
        "Vernal_pool",
        "Butterfly_gardening"
      ]
    };
  }
  if (month === 10 && day >= 15 || month === 11 && day <= 2) {
    return {
      label: "Halloween & Autumn Folklore",
      seasonTag: "halloween",
      slugs: [
        "Jack-o%27-lantern",
        "Trick-or-treating",
        "Samhain",
        "Haunted_house",
        "Day_of_the_Dead",
        "Headless_Horseman",
        "Salem_witch_trials",
        "Gothic_fiction",
        "Vampire_folklore",
        "Werewolf",
        "Frankenstein",
        "Bram_Stoker",
        "Black_cat",
        "Ghost_ship",
        "Will-o%27-the-wisp",
        "Gargoyle",
        "Common_raven",
        "Barn_owl",
        "Autumn_leaf_color",
        "Apple_bobbing"
      ]
    };
  }
  if (month === 11) {
    return {
      label: "Autumn & Harvest Season",
      seasonTag: "autumn",
      slugs: [
        "Gunpowder_Plot",
        "Guy_Fawkes_Night",
        "Fireworks",
        "Thanksgiving",
        "Mayflower",
        "Cornucopia",
        "Wild_turkey",
        "Pumpkin_pie",
        "Cranberry",
        "Harvest_festival",
        "Autumn_leaf_color",
        "Bird_migration"
      ]
    };
  }
  if (month === 12 || month === 1 && day <= 5) {
    return {
      label: "Christmas & Winter Season",
      seasonTag: "christmas",
      slugs: [
        "Christmas_tree",
        "Santa_Claus",
        "Reindeer",
        "Winter_solstice",
        "Snowflake",
        "The_Nutcracker",
        "Gingerbread_house",
        "Yule_log",
        "Mistletoe",
        "Christmas_carol",
        "Silent_Night",
        "Candy_cane",
        "Advent_calendar",
        "Christmas_market",
        "Sleigh",
        "Aurora",
        "New_Year%27s_Eve",
        "Auld_Lang_Syne"
      ]
    };
  }
  if (month === 2 && day <= 16) {
    return {
      label: "Valentine's & Romance",
      seasonTag: "winter",
      slugs: [
        "Valentine%27s_Day",
        "Cupid",
        "Garden_rose",
        "Chocolate_truffle",
        "Love_letter",
        "Courtly_love",
        "Romeo_and_Juliet",
        "Mute_swan"
      ]
    };
  }
  if (month === 3 && day >= 10 && day <= 25) {
    return {
      label: "St. Patrick's & Spring Equinox",
      seasonTag: "spring",
      slugs: [
        "Saint_Patrick%27s_Day",
        "Shamrock",
        "Leprechaun",
        "Celtic_mythology",
        "Spring_equinox",
        "Rainbow",
        "Cherry_blossom",
        "Giant%27s_Causeway"
      ]
    };
  }
  if (month >= 3 && month <= 5) {
    return {
      label: "Spring & Nature",
      seasonTag: "spring",
      slugs: [
        "Cherry_blossom",
        "Honey_bee",
        "Botanical_garden",
        "Rainforest",
        "Pollination",
        "Hummingbird",
        "Greenhouse",
        "Rainbow"
      ]
    };
  }
  if (month >= 6 && month <= 8) {
    return {
      label: "Summer & Solstice",
      seasonTag: "summer",
      slugs: [
        "Summer_solstice",
        "Stonehenge",
        "Coral_reef",
        "Bioluminescence",
        "Firefly",
        "Perseids",
        "Lighthouse",
        "Sandcastle"
      ]
    };
  }
  if (month >= 9 && month <= 10) {
    return {
      label: "Autumn & Harvest",
      seasonTag: "autumn",
      slugs: [
        "Autumn_leaf_color",
        "Harvest_festival",
        "Apple_orchard",
        "Monarch_butterfly_migration",
        "Equinox",
        "Deciduous_forest",
        "Jack-o%27-lantern",
        "Samhain"
      ]
    };
  }
  return {
    label: "Winter & Polar Wonders",
    seasonTag: "winter",
    slugs: [
      "Snowflake",
      "Aurora",
      "Glacier",
      "Polar_bear",
      "Emperor_penguin",
      "Iceberg",
      "Avalanche",
      "Winter_solstice"
    ]
  };
}
var recentArticleTitles = [];
var MAX_RECENT_HISTORY = 40;
var roundSelectionCounter = 0;
function markArticleUsed(title) {
  const norm = title.trim().toLowerCase();
  if (!recentArticleTitles.includes(norm)) {
    recentArticleTitles.push(norm);
    if (recentArticleTitles.length > MAX_RECENT_HISTORY) {
      recentArticleTitles.shift();
    }
  }
}
function isArticleRecentlyUsed(title) {
  return recentArticleTitles.includes(title.trim().toLowerCase());
}
function buildArticleSeedFromWikiSummary(data, defaultCategory) {
  const rawTitle = String(data?.title || "").replace(/\s*\([^)]*\)\s*/g, "").replace(/_/g, " ").trim();
  const extract = String(data?.extract || "").trim();
  if (!rawTitle || extract.length < 80) return null;
  const words = (rawTitle.toLowerCase().match(/[a-z]+/g) || []).filter(
    (w) => w.length >= 3 && w.length <= 9 && !STOPLIST.has(w)
  );
  const uniqueTitleWords = Array.from(new Set(words)).slice(0, 4);
  if (uniqueTitleWords.length < 1) return null;
  const extractTokens = (extract.toLowerCase().match(/[a-z]{4,10}/g) || []).filter(
    (w) => !STOPLIST.has(w)
  );
  return {
    title: rawTitle,
    category: data?.description ? `${defaultCategory} \xB7 ${String(data.description).slice(0, 36)}` : defaultCategory,
    extract,
    url: data?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(rawTitle)}`,
    titleWords: uniqueTitleWords,
    keywords: Array.from(new Set(extractTokens)).slice(0, 30)
  };
}
var cachedOnThisDayKey = "";
var cachedOnThisDayArticles = [];
async function getOnThisDayCandidates(now = /* @__PURE__ */ new Date()) {
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const key = `${mm}-${dd}`;
  if (cachedOnThisDayKey === key && cachedOnThisDayArticles.length > 0) {
    return cachedOnThisDayArticles;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2200);
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${mm}/${dd}`,
      {
        headers: { "User-Agent": "WiKirecTangled/2.0 (WordTycoon Live Puzzle)" },
        signal: controller.signal
      }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const events = [
        ...Array.isArray(data?.holidays) ? data.holidays : [],
        ...Array.isArray(data?.selected) ? data.selected : []
      ];
      const candidates = [];
      const seen = /* @__PURE__ */ new Set();
      for (const ev of events) {
        const pages = Array.isArray(ev?.pages) ? ev.pages : [];
        for (const p of pages) {
          const built = buildArticleSeedFromWikiSummary(p, `On This Day (${mm}/${dd})`);
          if (built && built.titleWords.length >= 2 && !seen.has(built.title.toLowerCase())) {
            seen.add(built.title.toLowerCase());
            candidates.push(built);
          }
        }
      }
      if (candidates.length > 0) {
        cachedOnThisDayKey = key;
        cachedOnThisDayArticles = candidates;
        return candidates;
      }
    }
  } catch {
  }
  return [];
}
async function fetchWikipediaRoundArticle(options) {
  const trie = getTrie();
  const freq = getFrequencyMap();
  if (options?.compactSingleWord) {
    const compactCandidates = [
      "pumpkin",
      "lantern",
      "phantom",
      "vampire",
      "harvest",
      "reindeer",
      "snowfall",
      "planet",
      "galaxy",
      "eclipse",
      "volcano",
      "glacier",
      "compass",
      "library",
      "crystal",
      "orchard",
      "monarch",
      "thunder",
      "harbor",
      "canyon"
    ];
    const chosen = options.seedKey ? compactCandidates[Math.abs(hashCode(options.seedKey)) % compactCandidates.length] : compactCandidates[Math.floor(Math.random() * compactCandidates.length)];
    trie.insert(chosen);
    return {
      title: chosen.toUpperCase(),
      category: "WikiWord 4\xD74 Target",
      extract: `Find the hidden target word (${chosen.length} letters) inside the 4\xD74 letter grid. Uncovering 75% of common words highlights the exact starting tile!`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(chosen)}`,
      titleWords: [chosen],
      keywords: [chosen]
    };
  }
  if (options?.seedKey && options.seedKey.startsWith("daily-")) {
    const idx = Math.abs(hashCode(options.seedKey)) % CURATED_WIKI_ARTICLES.length;
    const base = CURATED_WIKI_ARTICLES[idx];
    registerArticleWordsInDictionary(base, trie, freq);
    return base;
  }
  roundSelectionCounter += 1;
  const now = /* @__PURE__ */ new Date();
  const seasonalInfo = getDateSeasonalWikiSlugs(now);
  const preferDateRelated = roundSelectionCounter % 3 !== 0;
  if (preferDateRelated) {
    const unusedSlugs = seasonalInfo.slugs.filter((slug) => {
      const decoded = decodeURIComponent(slug).replace(/_/g, " ");
      return !isArticleRecentlyUsed(decoded);
    });
    if (unusedSlugs.length > 0 && roundSelectionCounter % 2 === 1) {
      const chosenSlug = unusedSlugs[Math.floor(Math.random() * unusedSlugs.length)];
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2200);
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${chosenSlug}`,
          {
            headers: { "User-Agent": "WiKirecTangled/2.0 (WordTycoon Live Puzzle)" },
            signal: controller.signal
          }
        );
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const article = buildArticleSeedFromWikiSummary(data, seasonalInfo.label);
          if (article && !isArticleRecentlyUsed(article.title)) {
            markArticleUsed(article.title);
            registerArticleWordsInDictionary(article, trie, freq);
            return article;
          }
        }
      } catch {
      }
    }
    const onThisDayPool = await getOnThisDayCandidates(now);
    const unusedOnThisDay = onThisDayPool.filter((a) => !isArticleRecentlyUsed(a.title));
    if (unusedOnThisDay.length > 0) {
      const pickedOtd = unusedOnThisDay[Math.floor(Math.random() * unusedOnThisDay.length)];
      markArticleUsed(pickedOtd.title);
      registerArticleWordsInDictionary(pickedOtd, trie, freq);
      return pickedOtd;
    }
    const matchingCuratedSeasonal = CURATED_WIKI_ARTICLES.filter(
      (a) => a.seasonTag === seasonalInfo.seasonTag && !isArticleRecentlyUsed(a.title)
    );
    if (matchingCuratedSeasonal.length > 0) {
      const picked2 = matchingCuratedSeasonal[Math.floor(Math.random() * matchingCuratedSeasonal.length)];
      markArticleUsed(picked2.title);
      registerArticleWordsInDictionary(picked2, trie, freq);
      return picked2;
    }
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2200);
    const res = await fetch("https://en.wikipedia.org/api/rest_v1/page/random/summary", {
      headers: { "User-Agent": "WiKirecTangled/2.0 (WordTycoon Live Puzzle)" },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const article = buildArticleSeedFromWikiSummary(
        data,
        "Wikipedia Featured Article"
      );
      if (article && article.titleWords.length >= 2 && !isArticleRecentlyUsed(article.title)) {
        markArticleUsed(article.title);
        registerArticleWordsInDictionary(article, trie, freq);
        return article;
      }
    }
  } catch {
  }
  const seasonalUnused = CURATED_WIKI_ARTICLES.filter(
    (a) => a.seasonTag === seasonalInfo.seasonTag && !isArticleRecentlyUsed(a.title)
  );
  const generalUnused = CURATED_WIKI_ARTICLES.filter(
    (a) => !isArticleRecentlyUsed(a.title)
  );
  const pool = seasonalUnused.length > 0 ? seasonalUnused : generalUnused.length > 0 ? generalUnused : CURATED_WIKI_ARTICLES;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  markArticleUsed(picked.title);
  registerArticleWordsInDictionary(picked, trie, freq);
  return picked;
}
function registerArticleWordsInDictionary(article, trie, freq) {
  for (const w of article.titleWords) {
    const clean = w.toLowerCase().replace(/[^a-z]/g, "");
    if (clean.length >= 3) {
      trie.insert(clean);
      if (!freq.has(clean)) freq.set(clean, 3.8);
    }
  }
  for (const w of article.keywords) {
    const clean = w.toLowerCase().replace(/[^a-z]/g, "");
    if (clean.length >= 3) {
      trie.insert(clean);
      if (!freq.has(clean)) freq.set(clean, 4.3);
    }
  }
  const tokens = article.extract.toLowerCase().match(/[a-z]{3,11}/g) || [];
  for (const tok of tokens) {
    if (STOPLIST.has(tok)) continue;
    trie.insert(tok);
    if (!freq.has(tok)) {
      freq.set(tok, tok.length >= 8 ? 2.6 : tok.length >= 6 ? 3.5 : 4.3);
    }
  }
}
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h;
}

// src/server/grid.ts
var LETTER_WEIGHTS = {
  a: 9,
  b: 2,
  c: 3,
  d: 4,
  e: 12,
  f: 2,
  g: 3,
  h: 3,
  i: 9,
  j: 1,
  k: 1,
  l: 5,
  m: 3,
  n: 7,
  o: 8,
  p: 3,
  q: 1,
  r: 7,
  s: 7,
  t: 7,
  u: 4,
  v: 2,
  w: 2,
  x: 1,
  y: 2,
  z: 1
};
var LETTER_POOL = (() => {
  const pool = [];
  for (const [letter, weight] of Object.entries(LETTER_WEIGHTS)) {
    for (let i = 0; i < weight; i++) pool.push(letter);
  }
  return pool;
})();
function randomLetter(rng = Math.random) {
  return LETTER_POOL[Math.floor(rng() * LETTER_POOL.length)];
}
function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function neighbors(cellIdx, rows, cols) {
  const r = Math.floor(cellIdx / cols);
  const c = cellIdx % cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        out.push(nr * cols + nc);
      }
    }
  }
  return out;
}
function pickDims(_totalLetters) {
  return { rows: 5, cols: 9 };
}
function placeWord(word, cells, rows, cols, rng, attempts = 80) {
  const total = rows * cols;
  const letters = word.toLowerCase().split("");
  for (let a = 0; a < attempts; a++) {
    const startCandidates = [];
    for (let i = 0; i < total; i++) {
      if (cells[i] === letters[0]) startCandidates.push(i);
    }
    for (let i = 0; i < total; i++) {
      if (cells[i] === null) startCandidates.push(i);
    }
    shuffle(startCandidates, rng);
    if (startCandidates.length === 0) return null;
    for (let sIdx = 0; sIdx < Math.min(startCandidates.length, 6); sIdx++) {
      const start = startCandidates[sIdx];
      const path2 = [start];
      const used = /* @__PURE__ */ new Set([start]);
      let ok = true;
      for (let li = 1; li < letters.length; li++) {
        const prev = path2[path2.length - 1];
        const wanted = letters[li];
        const matching = [];
        const blank = [];
        for (const n of neighbors(prev, rows, cols)) {
          if (used.has(n)) continue;
          if (cells[n] === wanted) matching.push(n);
          else if (cells[n] === null) blank.push(n);
        }
        shuffle(matching, rng);
        shuffle(blank, rng);
        const candidates = matching.concat(blank);
        if (candidates.length === 0) {
          ok = false;
          break;
        }
        const next = candidates[0];
        path2.push(next);
        used.add(next);
      }
      if (ok) {
        for (let i = 0; i < letters.length; i++) {
          cells[path2[i]] = letters[i];
        }
        return path2;
      }
    }
  }
  return null;
}
function tryPlacement(targets, rows, cols, rng) {
  const cells = new Array(rows * cols).fill(null);
  const paths = {};
  const ordered = [...targets].sort((a, b) => b.length - a.length);
  for (const word of ordered) {
    const p = placeWord(word, cells, rows, cols, rng);
    if (!p) return null;
    paths[word] = p;
  }
  return { cells, paths };
}
function findAllWords(grid, rows, cols, trie, minWordLength = 3) {
  const found = /* @__PURE__ */ new Map();
  const total = rows * cols;
  const visited = new Uint8Array(total);
  function dfs(idx, node, currentWord, path2) {
    if (node.isWord && currentWord.length >= minWordLength) {
      if (!found.has(currentWord)) {
        found.set(currentWord, [...path2]);
      }
    }
    if (path2.length >= 10) return;
    for (const nextIdx of neighbors(idx, rows, cols)) {
      if (visited[nextIdx]) continue;
      const ch = grid[nextIdx];
      const nextNode = node.children.get(ch);
      if (!nextNode) continue;
      visited[nextIdx] = 1;
      path2.push(nextIdx);
      dfs(nextIdx, nextNode, currentWord + ch, path2);
      path2.pop();
      visited[nextIdx] = 0;
    }
  }
  for (let i = 0; i < total; i++) {
    const ch = grid[i];
    const startNode = trie.root.children.get(ch);
    if (!startNode) continue;
    visited[i] = 1;
    dfs(i, startNode, ch, [i]);
    visited[i] = 0;
  }
  return found;
}
function createSeededRng(seedStr) {
  if (!seedStr) return Math.random;
  let seed = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    seed ^= seedStr.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed = Math.imul(seed, 1664525) + 1013904223 | 0;
    return (seed >>> 0) % 1e5 / 1e5;
  };
}
function buildGrid(targetsToPlace, bonusKeywords, trie, options = {}) {
  const rng = createSeededRng(options.seedStr);
  const totalLetters = targetsToPlace.reduce((s, w) => s + w.length, 0);
  const defaultDims = pickDims(totalLetters);
  const rows = options.rows || defaultDims.rows;
  const cols = options.cols || defaultDims.cols;
  const minWordLength = options.minWordLength || 3;
  let placedResult = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    placedResult = tryPlacement(targetsToPlace, rows, cols, rng);
    if (placedResult) break;
  }
  if (!placedResult) {
    const cells = new Array(rows * cols).fill(null);
    const paths = {};
    for (const w of targetsToPlace) {
      const p = placeWord(w, cells, rows, cols, rng);
      if (p) paths[w] = p;
    }
    placedResult = { cells, paths };
  }
  const extraPool = shuffle([...bonusKeywords].filter((k) => k.length >= 4 && k.length <= 7), rng).slice(0, 6);
  for (const kw of extraPool) {
    if (!placedResult.paths[kw]) {
      const p = placeWord(kw, placedResult.cells, rows, cols, rng, 20);
      if (p) placedResult.paths[kw] = p;
    }
  }
  const finalGrid = placedResult.cells.map((c) => c || randomLetter(rng));
  const allWords = findAllWords(finalGrid, rows, cols, trie, minWordLength);
  for (const [word, path2] of Object.entries(placedResult.paths)) {
    if (!allWords.has(word)) {
      allWords.set(word, path2);
    }
  }
  return {
    grid: finalGrid,
    rows,
    cols,
    allWords,
    targetPaths: placedResult.paths
  };
}

// src/server/game.ts
var ZIPF_COMMON_THRESHOLD = 4.2;
var ZIPF_ULTRA_THRESHOLD = 3;
var SCRABBLE_LETTER_VALUES = {
  a: 1,
  b: 3,
  c: 3,
  d: 2,
  e: 1,
  f: 4,
  g: 2,
  h: 4,
  i: 1,
  j: 8,
  k: 5,
  l: 1,
  m: 3,
  n: 1,
  o: 1,
  p: 3,
  q: 10,
  r: 1,
  s: 1,
  t: 1,
  u: 1,
  v: 4,
  w: 4,
  x: 8,
  y: 4,
  z: 10
};
var TITLE_BONUSES = [5e4, 35e3, 25e3, 2e4, 15e3];
var SLOT_BASE = {
  1: 16e3,
  2: 11e3,
  3: 8e3,
  4: 5600,
  5: 4e3
};
function getTitleBonus(findIndex) {
  return TITLE_BONUSES[findIndex] || 12e3;
}
function getWordLengthBonus(word) {
  const len = word.length;
  if (len <= 3) return 0;
  if (len === 4) return 150;
  if (len === 5) return 350;
  if (len === 6) return 700;
  if (len === 7) return 1200;
  return 2e3;
}
function getLetterRarityBonus(word) {
  let sum = 0;
  for (const ch of word) {
    sum += (SCRABBLE_LETTER_VALUES[ch] || 1) * 25;
  }
  return sum;
}
function wordSimilarity(a, b) {
  a = String(a || "").toLowerCase();
  b = String(b || "").toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bagA = {};
  const bagB = {};
  for (const c of a) bagA[c] = (bagA[c] || 0) + 1;
  for (const c of b) bagB[c] = (bagB[c] || 0) + 1;
  let shared = 0;
  for (const c in bagA) {
    if (bagB[c]) shared += Math.min(bagA[c], bagB[c]);
  }
  const overlap = shared / Math.max(a.length, b.length);
  const lenPen = 1 - Math.abs(a.length - b.length) / Math.max(a.length, b.length);
  let bonus = 0;
  for (let n = 2; n <= Math.min(a.length, b.length); n++) {
    let found = false;
    for (let i = 0; i <= a.length - n && !found; i++) {
      if (b.includes(a.slice(i, i + n))) {
        found = true;
        bonus = Math.max(bonus, n / Math.max(a.length, b.length));
      }
    }
  }
  return Math.min(0.99, 0.5 * overlap + 0.2 * lenPen + 0.35 * bonus);
}
var WiKirecGame = class {
  constructor(roundId, mode) {
    this.grid = [];
    this.rows = 0;
    this.cols = 0;
    this.minWordLength = 3;
    this.allWords = /* @__PURE__ */ new Map();
    this.targetPaths = {};
    this.titleWords = [];
    this.titleWordSet = /* @__PURE__ */ new Set();
    this.titleSingularToPlural = /* @__PURE__ */ new Map();
    this.revealedTitleWords = /* @__PURE__ */ new Map();
    this.commonWords = /* @__PURE__ */ new Map();
    this.rareWords = /* @__PURE__ */ new Map();
    this.ultraRareWords = /* @__PURE__ */ new Map();
    this.threeLetterWords = /* @__PURE__ */ new Map();
    this.foundWords = /* @__PURE__ */ new Map();
    this.foundCommon = /* @__PURE__ */ new Map();
    this.foundRare = /* @__PURE__ */ new Map();
    this.foundUltra = /* @__PURE__ */ new Map();
    this.playerScores = /* @__PURE__ */ new Map();
    this.recentTags = [];
    this.guessCounts = /* @__PURE__ */ new Map();
    this.rankTarget = "";
    this.totalRankedWords = 5e4;
    this.rankedGuesses = /* @__PURE__ */ new Map();
    this.rankSlotsPaid = /* @__PURE__ */ new Set();
    this.articleWordSet = /* @__PURE__ */ new Set();
    this.startTime = Date.now();
    this.roundEndCountdownSec = null;
    this.activeHint = null;
    this.hintStepCounter = 0;
    this.roundId = roundId;
    this.mode = mode;
  }
  initialize(article, built) {
    this.article = article;
    this.grid = built.grid;
    this.rows = built.rows;
    this.cols = built.cols;
    this.allWords = built.allWords;
    this.targetPaths = built.targetPaths;
    this.startTime = Date.now();
    const freq = getFrequencyMap();
    const seenTitle = /* @__PURE__ */ new Set();
    this.titleWords = [];
    for (const raw of article.titleWords) {
      const clean = raw.toLowerCase().replace(/[^a-z]/g, "");
      if (clean && !seenTitle.has(clean)) {
        seenTitle.add(clean);
        this.titleWords.push(clean);
      }
    }
    this.titleWordSet = new Set(this.titleWords);
    this.titleSingularToPlural.clear();
    this.articleWordSet.clear();
    const tokens = (article.title + " " + article.extract + " " + article.keywords.join(" ")).toLowerCase().match(/[a-z]{3,14}/g) || [];
    for (const t of tokens) {
      this.articleWordSet.add(t);
    }
    this.commonWords.clear();
    this.rareWords.clear();
    this.ultraRareWords.clear();
    this.threeLetterWords.clear();
    const sortedWords = Array.from(this.allWords.entries());
    for (const [word, path2] of sortedWords) {
      if (word.length === 3) {
        this.threeLetterWords.set(word, path2);
        continue;
      }
      const z = freq.get(word) ?? 3.2;
      const isArticleKeyword = article.keywords.includes(word) || this.titleWordSet.has(word);
      if (word.length >= 6 && (z < ZIPF_ULTRA_THRESHOLD || this.titleWordSet.has(word))) {
        this.ultraRareWords.set(word, path2);
      } else if (z < ZIPF_COMMON_THRESHOLD || isArticleKeyword || word.length >= 6) {
        this.rareWords.set(word, path2);
      } else {
        this.commonWords.set(word, path2);
      }
    }
    if (this.mode !== "wikiword-4x4") {
      if (this.rareWords.size < 4) {
        for (const [w, p] of this.commonWords.entries()) {
          if (w.length >= 5) {
            this.rareWords.set(w, p);
            this.commonWords.delete(w);
            if (this.rareWords.size >= 8) break;
          }
        }
      }
      if (this.ultraRareWords.size === 0) {
        for (const [w, p] of this.rareWords.entries()) {
          if (w.length >= 5) {
            this.ultraRareWords.set(w, p);
            this.rareWords.delete(w);
            if (this.ultraRareWords.size >= 3) break;
          }
        }
      }
    }
    this.rankTarget = this.titleWords[0] || "planet";
  }
  pickNextRankTarget() {
    for (const tw of this.titleWords) {
      if (!this.revealedTitleWords.has(tw)) {
        if (this.rankTarget !== tw) {
          this.rankTarget = tw;
          this.rankedGuesses.clear();
          this.rankSlotsPaid.clear();
        }
        return;
      }
    }
  }
  computeSemanticRank(word) {
    const target = this.rankTarget || this.titleWords[0] || "";
    if (!target) return { rank: 25e3, closeness: 0.1 };
    if (word === target) {
      return { rank: 1, closeness: 1 };
    }
    const lexSim = wordSimilarity(word, target);
    const inArticle = this.articleWordSet.has(word);
    const isKeyword = this.article.keywords.includes(word);
    const isTitle = this.titleWordSet.has(word);
    let score = lexSim * 0.65;
    if (isTitle) score += 0.32;
    else if (isKeyword) score += 0.28;
    else if (inArticle) score += 0.18;
    score = Math.min(0.98, Math.max(0.02, score));
    const rank = Math.max(2, Math.round(Math.pow(1 - score, 2.6) * this.totalRankedWords));
    return { rank, closeness: score };
  }
  guess(wordRaw, finder) {
    const norm = String(wordRaw || "").trim().toLowerCase().replace(/[^a-z]/g, "");
    if (!norm || norm.length < this.minWordLength) {
      return {
        result: "too_short",
        word: norm,
        cells: [],
        points: 0,
        guessCount: 0,
        tierName: null,
        isTitleWord: false,
        rank: null,
        closeness: 0,
        finder
      };
    }
    const gc = (this.guessCounts.get(norm) || 0) + 1;
    this.guessCounts.set(norm, gc);
    const chipKey = norm;
    const isUnrevealedTitle = this.titleWordSet.has(norm) && !this.revealedTitleWords.has(chipKey);
    const { rank, closeness } = this.computeSemanticRank(norm);
    if (this.foundWords.has(norm) && !isUnrevealedTitle) {
      this.pushTag({
        id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        result: "already_found",
        word: norm,
        displayName: finder.displayName,
        platform: finder.platform,
        profileImage: finder.profileImage,
        rank,
        closeness,
        guessCount: gc,
        ts: Date.now()
      });
      return {
        result: "already_found",
        word: norm,
        cells: this.foundWords.get(norm)?.cells || [],
        points: 0,
        guessCount: gc,
        tierName: null,
        isTitleWord: false,
        rank,
        closeness,
        finder
      };
    }
    let rankSlotAwarded = null;
    let rankPoints = 0;
    if (!this.rankedGuesses.has(norm)) {
      this.rankedGuesses.set(norm, {
        word: norm,
        rank,
        closeness,
        finder,
        timestamp: Date.now(),
        pointsAwarded: 0
      });
      const top5 = this.getTargetCards();
      const slotIdx = top5.findIndex((c) => c.word === norm);
      if (slotIdx !== -1) {
        const slot = slotIdx + 1;
        if (!this.rankSlotsPaid.has(slot)) {
          this.rankSlotsPaid.add(slot);
          const base = SLOT_BASE[slot] || 0;
          const mult = Math.max(0.25, 1 - Math.log10(Math.max(1, rank)) / 5);
          rankPoints = Math.floor(base * mult);
          rankSlotAwarded = slot;
          const entry2 = this.rankedGuesses.get(norm);
          if (entry2) entry2.pointsAwarded = rankPoints;
        }
      }
    }
    const inGrid = this.allWords.has(norm);
    if (!inGrid) {
      if (isUnrevealedTitle) {
        this.revealedTitleWords.set(chipKey, finder);
        const titleBonus2 = getTitleBonus(this.revealedTitleWords.size - 1);
        const path2 = this.targetPaths[chipKey] || [];
        const entry2 = {
          word: chipKey,
          tier: "title",
          points: titleBonus2,
          displayName: finder.displayName,
          platform: finder.platform,
          platformUserId: finder.platformUserId,
          profileImage: finder.profileImage,
          timestamp: Date.now(),
          cells: path2,
          isTitleWord: true
        };
        this.foundWords.set(chipKey, entry2);
        this.creditPlayer(finder, titleBonus2, 1, true);
        this.pushTag({
          id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          result: "correct",
          word: chipKey,
          displayName: finder.displayName,
          platform: finder.platform,
          profileImage: finder.profileImage,
          points: titleBonus2,
          tier: "title",
          rank: 1,
          closeness: 1,
          guessCount: gc,
          ts: Date.now()
        });
        this.pickNextRankTarget();
        return {
          result: "correct",
          word: chipKey,
          cells: path2,
          points: titleBonus2,
          guessCount: gc,
          tierName: "title",
          isTitleWord: true,
          rank: 1,
          closeness: 1,
          rankSlotAwarded,
          rankPoints: 0,
          finder
        };
      }
      const inArticle = this.articleWordSet.has(norm);
      const resType = inArticle ? "miss_in_article" : "incorrect";
      this.pushTag({
        id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        result: resType,
        word: norm,
        displayName: finder.displayName,
        platform: finder.platform,
        profileImage: finder.profileImage,
        rank,
        closeness,
        guessCount: gc,
        ts: Date.now()
      });
      return {
        result: resType,
        word: norm,
        cells: [],
        points: 0,
        guessCount: gc,
        tierName: null,
        isTitleWord: false,
        rank,
        closeness,
        rankSlotAwarded,
        rankPoints: 0,
        finder
      };
    }
    let tierName = "common";
    if (this.ultraRareWords.has(norm)) tierName = "ultra";
    else if (this.rareWords.has(norm)) tierName = "rare";
    else if (this.commonWords.has(norm)) tierName = "common";
    else if (norm.length === 3) tierName = "three";
    let baseScore = 1e3;
    if (tierName === "three") baseScore = 100;
    else if (tierName === "common") baseScore = 1e3;
    else if (tierName === "rare") baseScore = 2500;
    else if (tierName === "ultra") baseScore = 5e3;
    const lengthBonus = getWordLengthBonus(norm);
    const rarityBonus = getLetterRarityBonus(norm);
    let titleBonus = 0;
    if (isUnrevealedTitle) {
      this.revealedTitleWords.set(chipKey, finder);
      titleBonus = getTitleBonus(this.revealedTitleWords.size - 1);
      tierName = "title";
      this.pickNextRankTarget();
    }
    const totalPoints = baseScore + lengthBonus + rarityBonus + titleBonus;
    const cells = this.allWords.get(norm) || [];
    const entry = {
      word: norm,
      tier: tierName,
      points: totalPoints,
      displayName: finder.displayName,
      platform: finder.platform,
      platformUserId: finder.platformUserId,
      profileImage: finder.profileImage,
      timestamp: Date.now(),
      cells,
      isTitleWord: isUnrevealedTitle
    };
    this.foundWords.set(norm, entry);
    if (this.commonWords.has(norm)) this.foundCommon.set(norm, finder);
    if (this.rareWords.has(norm)) this.foundRare.set(norm, finder);
    if (this.ultraRareWords.has(norm)) this.foundUltra.set(norm, finder);
    this.creditPlayer(finder, totalPoints, 1, isUnrevealedTitle);
    this.pushTag({
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      result: "correct",
      word: norm,
      displayName: finder.displayName,
      platform: finder.platform,
      profileImage: finder.profileImage,
      points: totalPoints,
      tier: tierName,
      rank: isUnrevealedTitle ? 1 : rank,
      closeness: isUnrevealedTitle ? 1 : closeness,
      guessCount: gc,
      ts: Date.now()
    });
    if (this.activeHint && cells[0] === this.activeHint.startCell) {
      this.activeHint = null;
    }
    return {
      result: "correct",
      word: norm,
      cells,
      points: totalPoints,
      guessCount: gc,
      tierName,
      isTitleWord: isUnrevealedTitle,
      rank,
      closeness,
      rankSlotAwarded,
      rankPoints,
      finder
    };
  }
  requestHint() {
    let targetWord = null;
    let targetCells = null;
    let wordTier = "title";
    for (const tw of this.titleWords) {
      if (!this.revealedTitleWords.has(tw)) {
        targetWord = tw;
        targetCells = this.allWords.get(tw) || this.targetPaths[tw] || null;
        wordTier = "title";
        break;
      }
    }
    if (!targetWord) {
      const phase = this.getCurrentTierPhase();
      const map = phase === "ultra" ? this.ultraRareWords : phase === "rare" ? this.rareWords : this.commonWords;
      const found = phase === "ultra" ? this.foundUltra : phase === "rare" ? this.foundRare : this.foundCommon;
      for (const [w, c] of map.entries()) {
        if (!found.has(w)) {
          targetWord = w;
          targetCells = c;
          wordTier = phase === "complete" ? "common" : phase;
          break;
        }
      }
    }
    if (!targetWord || !targetCells || targetCells.length === 0) return null;
    this.hintStepCounter = this.hintStepCounter % 4 + 1;
    const tier = this.hintStepCounter;
    const startCell = targetCells[0];
    const secondCell = targetCells[1];
    const r0 = Math.floor(startCell / this.cols);
    const c0 = startCell % this.cols;
    let orientation = "8-Connected Snake";
    if (typeof secondCell === "number") {
      const r1 = Math.floor(secondCell / this.cols);
      const c1 = secondCell % this.cols;
      const dr = r1 - r0;
      const dc = c1 - c0;
      if (dr === 0) orientation = dc > 0 ? "Starts Horizontal Right (\u2192)" : "Starts Horizontal Left (\u2190)";
      else if (dc === 0) orientation = dr > 0 ? "Starts Vertical Down (\u2193)" : "Starts Vertical Up (\u2191)";
      else orientation = `Starts Diagonal (${dr > 0 ? "Down" : "Up"}-${dc > 0 ? "Right" : "Left"})`;
    }
    const hint = {
      tier,
      label: tier === 1 ? `Tier 1 Hint: Starting letter '${targetWord[0].toUpperCase()}' highlighted at Row ${r0 + 1}, Col ${c0 + 1}` : tier === 2 ? `Tier 2 Hint: ${orientation} (${targetWord.length} letters)` : tier === 3 ? `Tier 3 Hint: Starts in Column ${c0 + 1} with "${targetWord.slice(0, 2).toUpperCase()}..."` : `Tier 4 Hint: First 3 letters "${targetWord.slice(0, 3).toUpperCase()}..." (${targetWord.length} letters)`,
      wordLength: targetWord.length,
      startCell,
      secondCell,
      orientation,
      column: c0 + 1,
      row: r0 + 1,
      revealedPrefix: targetWord.slice(0, Math.min(tier, 3)).toUpperCase(),
      wordTier
    };
    this.activeHint = hint;
    return hint;
  }
  recordEngagement(user, type, count = 1) {
    const prev = this.playerScores.get(user.platformUserId);
    if (!prev) return;
    if (type === "like") {
      prev.likesSent = (prev.likesSent || 0) + count;
      prev.xp += count * 2;
    } else {
      prev.giftsDiamonds = (prev.giftsDiamonds || 0) + count;
      prev.xp += count * 25;
    }
    this.playerScores.set(user.platformUserId, prev);
  }
  creditPlayer(finder, points, wordsFound, isTitle) {
    const prev = this.playerScores.get(finder.platformUserId) || {
      platformUserId: finder.platformUserId,
      displayName: finder.displayName,
      platform: finder.platform,
      profileImage: finder.profileImage,
      score: 0,
      xp: 0,
      wordCount: 0,
      targetCount: 0,
      titleWordCount: 0,
      likesSent: 0,
      giftsDiamonds: 0
    };
    prev.displayName = finder.displayName || prev.displayName;
    prev.profileImage = finder.profileImage || prev.profileImage;
    prev.score += points;
    prev.xp += Math.round(points / 10);
    prev.wordCount += wordsFound;
    if (isTitle) prev.titleWordCount += 1;
    this.playerScores.set(finder.platformUserId, prev);
  }
  pushTag(tag) {
    this.recentTags.push(tag);
    if (this.recentTags.length > 18) {
      this.recentTags.shift();
    }
  }
  getCommonWordTarget() {
    if (this.mode === "wikiword-4x4") return 0;
    const count = this.commonWords.size;
    return count > 0 ? Math.max(3, Math.ceil(count * 0.25)) : 0;
  }
  getRareWordTarget() {
    if (this.mode === "wikiword-4x4") return 0;
    const count = this.rareWords.size;
    return count > 0 ? Math.max(2, Math.ceil(count * 0.12)) : 0;
  }
  getUltraWordTarget() {
    if (this.mode === "wikiword-4x4") return 0;
    const count = this.ultraRareWords.size;
    return count > 0 ? Math.min(3, count) : 0;
  }
  getCurrentTierPhase() {
    const cTarget = this.getCommonWordTarget();
    if (cTarget > 0 && this.foundCommon.size < cTarget) return "common";
    const rTarget = this.getRareWordTarget();
    if (rTarget > 0 && this.foundRare.size < rTarget) return "rare";
    const uTarget = this.getUltraWordTarget();
    if (uTarget > 0 && this.foundUltra.size < uTarget) return "ultra";
    return "complete";
  }
  isComplete() {
    return this.titleWords.length > 0 && this.revealedTitleWords.size >= this.titleWords.length;
  }
  getTitleChips() {
    return this.titleWords.map((w, index) => ({
      index,
      word: this.revealedTitleWords.has(w) ? w : null,
      length: w.length,
      revealed: this.revealedTitleWords.has(w),
      finder: this.revealedTitleWords.get(w) || null
    }));
  }
  getTargetCards() {
    const sorted = Array.from(this.rankedGuesses.values()).sort(
      (a, b) => a.rank - b.rank || a.word.localeCompare(b.word)
    );
    const out = [];
    for (let i = 0; i < 5; i++) {
      const g = sorted[i];
      if (g) {
        out.push({
          position: i + 1,
          rank: g.rank,
          word: g.word,
          revealed: true,
          closeness: g.closeness,
          finder: g.finder,
          isTarget: g.word === this.rankTarget,
          pointsAwarded: g.pointsAwarded
        });
      } else {
        out.push({
          position: i + 1,
          rank: null,
          word: null,
          revealed: false,
          closeness: 0,
          finder: null,
          isPlaceholder: true
        });
      }
    }
    return out;
  }
  getActiveTierStartCells() {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const pushIfNew = (idx, tier, filled) => {
      if (seen.has(idx)) return;
      seen.add(idx);
      out.push({ idx, tier, filled });
    };
    if (this.mode === "wikiword-4x4") {
      const commonTotal = this.commonWords.size;
      const found = this.foundCommon.size;
      for (const tw of this.titleWords) {
        if (this.revealedTitleWords.has(tw)) continue;
        const cells = this.allWords.get(tw) || this.targetPaths[tw];
        if (cells && cells.length > 0) {
          pushIfNew(cells[0], "common", commonTotal > 0 && found * 4 >= commonTotal * 3);
        }
      }
      return out;
    }
    const phase = this.getCurrentTierPhase();
    if (phase === "common" || phase === "rare" || phase === "ultra") {
      const map = phase === "rare" ? this.rareWords : phase === "ultra" ? this.ultraRareWords : this.commonWords;
      const found = phase === "rare" ? this.foundRare : phase === "ultra" ? this.foundUltra : this.foundCommon;
      for (const [word, cells] of map.entries()) {
        if (found.has(word)) continue;
        if (cells.length > 0) pushIfNew(cells[0], phase);
      }
      return out;
    }
    for (const tw of this.titleWords) {
      if (this.revealedTitleWords.has(tw)) continue;
      const cells = this.allWords.get(tw) || this.targetPaths[tw];
      if (cells && cells.length > 0) {
        pushIfNew(cells[0], "ultra");
      }
    }
    return out;
  }
  getActiveCommonCells() {
    const active = /* @__PURE__ */ new Set();
    const phase = this.getCurrentTierPhase();
    const map = phase === "rare" ? this.rareWords : phase === "ultra" ? this.ultraRareWords : this.commonWords;
    const found = phase === "rare" ? this.foundRare : phase === "ultra" ? this.foundUltra : this.foundCommon;
    if (phase !== "complete") {
      for (const [w, cells] of map.entries()) {
        if (!found.has(w)) {
          for (const c of cells) active.add(c);
        }
      }
    }
    for (const tw of this.titleWords) {
      if (!this.revealedTitleWords.has(tw)) {
        const cells = this.allWords.get(tw) || this.targetPaths[tw] || [];
        for (const c of cells) active.add(c);
      }
    }
    return Array.from(active);
  }
  getSearchWords() {
    const slots = [];
    this.titleWords.forEach((tw, idx) => {
      const finder = this.revealedTitleWords.get(tw) || null;
      const foundEntry = this.foundWords.get(tw);
      slots.push({
        id: `title-${idx}-${tw.length}`,
        tier: "title",
        length: tw.length,
        startLetter: tw[0].toUpperCase(),
        revealed: !!finder,
        word: finder ? tw.toUpperCase() : null,
        unmaskedWord: tw.toUpperCase(),
        finderName: finder?.displayName || null,
        points: foundEntry?.points,
        cells: foundEntry?.cells || []
      });
    });
    const addTierSlots = (tier, wordMap, foundMap, targetCount) => {
      const foundWordsList = Array.from(foundMap.entries());
      const unfoundWordsList = Array.from(wordMap.keys()).filter((w) => !foundMap.has(w));
      const totalToShow = Math.max(targetCount, foundWordsList.length);
      let count = 0;
      for (const [w, finder] of foundWordsList) {
        if (count >= totalToShow) break;
        const entry = this.foundWords.get(w);
        slots.push({
          id: `${tier}-found-${w}`,
          tier,
          length: w.length,
          startLetter: w[0].toUpperCase(),
          revealed: true,
          word: w.toUpperCase(),
          unmaskedWord: w.toUpperCase(),
          finderName: finder.displayName,
          points: entry?.points,
          cells: entry?.cells || wordMap.get(w) || []
        });
        count++;
      }
      for (let i = 0; i < unfoundWordsList.length && count < totalToShow; i++) {
        const w = unfoundWordsList[i];
        slots.push({
          id: `${tier}-unfound-${i}-${w.length}`,
          tier,
          length: w.length,
          startLetter: w[0].toUpperCase(),
          revealed: false,
          word: null,
          unmaskedWord: w.toUpperCase(),
          finderName: null,
          cells: wordMap.get(w) || []
        });
        count++;
      }
    };
    addTierSlots("common", this.commonWords, this.foundCommon, this.getCommonWordTarget());
    addTierSlots("rare", this.rareWords, this.foundRare, this.getRareWordTarget());
    addTierSlots("ultra", this.ultraRareWords, this.foundUltra, this.getUltraWordTarget());
    return slots;
  }
  publicState() {
    const allTitleRevealed = this.titleWords.length > 0 && this.revealedTitleWords.size >= this.titleWords.length;
    const showArticle = this.isComplete() || allTitleRevealed;
    return {
      roundId: this.roundId,
      mode: this.mode,
      grid: this.grid,
      rows: this.rows,
      cols: this.cols,
      minWordLength: this.minWordLength,
      articleTitle: showArticle ? this.article.title : null,
      unmaskedArticleTitle: this.article.title,
      articleExtract: showArticle ? this.article.extract : null,
      articleCategory: this.article.category,
      articleUrl: showArticle ? this.article.url : null,
      titleChips: this.getTitleChips(),
      targets: this.getTargetCards(),
      foundWords: Array.from(this.foundWords.values()).sort((a, b) => b.timestamp - a.timestamp),
      foundCount: this.foundWords.size,
      totalGridWords: this.allWords.size,
      titleWordCount: this.titleWords.length,
      revealedTitleWordCount: this.revealedTitleWords.size,
      commonWordCount: this.commonWords.size,
      commonWordTarget: this.getCommonWordTarget(),
      foundCommonCount: this.foundCommon.size,
      rareWordCount: this.rareWords.size,
      rareWordTarget: this.getRareWordTarget(),
      foundRareCount: this.foundRare.size,
      ultraWordCount: this.ultraRareWords.size,
      ultraWordTarget: this.getUltraWordTarget(),
      foundUltraCount: this.foundUltra.size,
      currentTierPhase: this.getCurrentTierPhase(),
      activeTierStartCells: this.getActiveTierStartCells(),
      activeCommonCells: this.getActiveCommonCells(),
      topPlayers: Array.from(this.playerScores.values()).filter((p) => p.wordCount > 0 && p.score > 0).sort((a, b) => b.score - a.score),
      recentTags: this.recentTags.slice(-14),
      searchWords: this.getSearchWords(),
      isComplete: this.isComplete(),
      startTime: this.startTime,
      roundEndCountdownSec: this.roundEndCountdownSec,
      rankTargetHint: `${this.rankTarget.length} letters \xB7 Category: ${this.article.category}`,
      totalRankedWords: this.totalRankedWords,
      activeHint: this.activeHint
    };
  }
};
async function createNewGameInstance(mode, seedKey) {
  const trie = getTrie();
  const isCompact = mode === "wikiword-4x4";
  const article = await fetchWikipediaRoundArticle({
    seedKey,
    compactSingleWord: isCompact
  });
  const built = buildGrid(
    article.titleWords,
    article.keywords,
    trie,
    { rows: 5, cols: 9, minWordLength: 3, seedStr: seedKey }
  );
  const roundId = `${mode}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const game = new WiKirecGame(roundId, mode);
  game.initialize(article, built);
  return game;
}

// server.ts
var BaseTikTokConnection = TikTokConnector.WebcastPushConnection || TikTokConnector.TikTokLiveConnection;
var WebcastPushConnection2 = class extends BaseTikTokConnection {
  constructor(username, options = {}) {
    super(username, options);
  }
};
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PORT = Number(process.env.PORT) || 3e3;
process.env.DISABLE_HMR = "true";
function normalizeChatData(data) {
  const uniqueId = String(
    data?.uniqueId || data?.user?.displayId || data?.user?.uniqueId || data?.username || data?.user?.id || "tiktok_viewer"
  );
  const nickname = String(
    data?.nickname || data?.user?.nickname || data?.displayName || uniqueId
  );
  const comment = String(
    data?.comment ?? data?.content ?? data?.text ?? data?.message ?? ""
  ).trim();
  const profilePictureUrl = String(
    data?.profilePictureUrl || data?.user?.profilePictureUrl || data?.user?.avatarThumb?.urlList?.[0] || data?.user?.avatarMedium?.urlList?.[0] || data?.user?.avatarLarger?.urlList?.[0] || data?.user?.profilePicture?.url?.[0] || data?.user?.profilePicture?.urls?.[0] || ""
  );
  return {
    uniqueId,
    nickname,
    comment,
    profilePictureUrl
  };
}
function normalizeLikeData(data) {
  const uniqueId = String(
    data?.uniqueId || data?.user?.displayId || data?.user?.uniqueId || data?.username || data?.user?.id || "tiktok_viewer"
  );
  const nickname = String(
    data?.nickname || data?.user?.nickname || data?.displayName || uniqueId
  );
  const likeCount = Math.max(1, Number(data?.likeCount || data?.count || 1));
  const totalLikeCount = Number(data?.totalLikeCount || data?.total || likeCount);
  const profilePictureUrl = String(
    data?.profilePictureUrl || data?.user?.profilePictureUrl || data?.user?.avatarThumb?.urlList?.[0] || data?.user?.profilePicture?.url?.[0] || ""
  );
  return {
    uniqueId,
    nickname,
    likeCount,
    totalLikeCount,
    profilePictureUrl
  };
}
function normalizeGiftData(data) {
  const uniqueId = String(
    data?.uniqueId || data?.user?.displayId || data?.user?.uniqueId || data?.username || data?.user?.id || "tiktok_viewer"
  );
  const nickname = String(
    data?.nickname || data?.user?.nickname || data?.displayName || uniqueId
  );
  const giftName = String(
    data?.giftName || data?.gift?.name || data?.giftDetails?.giftName || data?.extendedGiftInfo?.name || "TikTok Gift"
  );
  const diamondCount = Math.max(
    1,
    Number(
      data?.diamondCount || data?.gift?.diamondCount || data?.giftDetails?.diamondCount || 10
    )
  );
  const repeatCount = Math.max(1, Number(data?.repeatCount || 1));
  const repeatEnd = Boolean(data?.repeatEnd ?? true);
  const profilePictureUrl = String(
    data?.profilePictureUrl || data?.user?.profilePictureUrl || data?.user?.avatarThumb?.urlList?.[0] || data?.user?.profilePicture?.url?.[0] || ""
  );
  return {
    uniqueId,
    nickname,
    giftName,
    diamondCount,
    repeatCount,
    repeatEnd,
    profilePictureUrl
  };
}
async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const pathname = request.url ? request.url.split("?")[0] : "";
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });
  const clients = /* @__PURE__ */ new Map();
  const soloGames = /* @__PURE__ */ new Map();
  const liveChatHistory = [];
  let multiplayerGame = await createNewGameInstance("multiplayer", `boot-${Date.now()}`);
  let wikiword4x4Game = await createNewGameInstance("wikiword-4x4", `boot4x4-${Date.now()}`);
  let mpCountdownInterval = null;
  let wwCountdownInterval = null;
  const activeStreamers = /* @__PURE__ */ new Map();
  function createDefaultStreamerSession(username, sessionId) {
    return {
      username,
      sessionId,
      token: `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      lastActivity: Date.now(),
      conn: null,
      reconnectTimer: null,
      desiredLiveUsername: null,
      currentRoomId: null,
      status: {
        connected: false,
        mode: "webhook-ready",
        username,
        tikfinityUrl: null,
        viewerCount: 0,
        chatEventsProcessed: 0,
        guessesFromChat: 0,
        likesCount: 0,
        giftsDiamonds: 0,
        lastError: null
      },
      chatHistory: []
    };
  }
  const fallbackTikTokStatus = {
    connected: false,
    mode: "webhook-ready",
    username: null,
    tikfinityUrl: null,
    viewerCount: 0,
    chatEventsProcessed: 0,
    guessesFromChat: 0,
    likesCount: 0,
    giftsDiamonds: 0,
    lastError: null
  };
  let tiktokStatus = fallbackTikTokStatus;
  let authorizedUsers = [
    {
      username: "mindtipgames",
      key: "LIVE-KEY-2026",
      label: "Official MindTipGames Live",
      createdAt: Date.now()
    }
  ];
  let adminCredentials = {
    username: "Admin",
    password: "MissingWiki"
  };
  function cleanStreamerUsername(raw) {
    return String(raw || "").trim().replace(/^@/, "").toLowerCase();
  }
  function isStreamerAuthorized(username, key) {
    const clean = cleanStreamerUsername(username);
    if (!clean) return false;
    const found = authorizedUsers.find(
      (u) => cleanStreamerUsername(u.username) === clean
    );
    if (!found) return false;
    if (key !== void 0) {
      return String(found.key).trim() === String(key).trim();
    }
    return true;
  }
  function getTodaySeed() {
    const now = /* @__PURE__ */ new Date();
    return `daily-${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  }
  function broadcastToMode(mode, message) {
    const raw = JSON.stringify(message);
    for (const [ws, meta] of clients.entries()) {
      if (ws.readyState === WebSocket.OPEN && meta.mode === mode) {
        ws.send(raw);
      }
    }
  }
  function broadcastAll(message) {
    const raw = JSON.stringify(message);
    for (const [ws] of clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }
  function getViewerPresence() {
    let mpViewers = 0;
    let soloViewers = 0;
    let wwViewers = 0;
    for (const meta of clients.values()) {
      if (meta.mode === "multiplayer") mpViewers++;
      else if (meta.mode === "wikiword-4x4") wwViewers++;
      else soloViewers++;
    }
    return {
      totalConnected: clients.size,
      mpViewers,
      soloViewers,
      wwViewers
    };
  }
  function pushLiveChatItem(item) {
    liveChatHistory.push(item);
    if (liveChatHistory.length > 50) {
      liveChatHistory.shift();
    }
    broadcastAll({
      type: "chat:event",
      item
    });
  }
  let desiredTikTokUsername = null;
  let tiktokReconnectTimer = null;
  function scheduleRoundRollover(mode) {
    if (mode === "multiplayer") {
      if (mpCountdownInterval) return;
      multiplayerGame.roundEndCountdownSec = 15;
      broadcastToMode("multiplayer", {
        type: "game:state",
        state: multiplayerGame.publicState()
      });
      mpCountdownInterval = setInterval(async () => {
        if (multiplayerGame.roundEndCountdownSec !== null && multiplayerGame.roundEndCountdownSec > 1) {
          multiplayerGame.roundEndCountdownSec -= 1;
          broadcastToMode("multiplayer", {
            type: "game:countdown",
            seconds: multiplayerGame.roundEndCountdownSec
          });
        } else {
          if (mpCountdownInterval) clearInterval(mpCountdownInterval);
          mpCountdownInterval = null;
          multiplayerGame = await createNewGameInstance("multiplayer");
          broadcastToMode("multiplayer", {
            type: "game:state",
            state: multiplayerGame.publicState()
          });
          broadcastAll({ type: "tiktok:status", status: tiktokStatus });
        }
      }, 1e3);
    } else {
      if (wwCountdownInterval) return;
      wikiword4x4Game.roundEndCountdownSec = 10;
      broadcastToMode("wikiword-4x4", {
        type: "game:state",
        state: wikiword4x4Game.publicState()
      });
      wwCountdownInterval = setInterval(async () => {
        if (wikiword4x4Game.roundEndCountdownSec !== null && wikiword4x4Game.roundEndCountdownSec > 1) {
          wikiword4x4Game.roundEndCountdownSec -= 1;
          broadcastToMode("wikiword-4x4", {
            type: "game:countdown",
            seconds: wikiword4x4Game.roundEndCountdownSec
          });
        } else {
          if (wwCountdownInterval) clearInterval(wwCountdownInterval);
          wwCountdownInterval = null;
          wikiword4x4Game = await createNewGameInstance("wikiword-4x4");
          broadcastToMode("wikiword-4x4", {
            type: "game:state",
            state: wikiword4x4Game.publicState()
          });
          broadcastAll({ type: "tiktok:status", status: tiktokStatus });
        }
      }, 1e3);
    }
  }
  function extractSingleWordFromChat(rawComment) {
    const strippedPunctuation = String(rawComment || "").replace(/['’`]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").trim();
    if (!strippedPunctuation) return null;
    const words = strippedPunctuation.split(/\s+/).filter(Boolean);
    if (words.length !== 1) return null;
    const singleWord = words[0].toLowerCase();
    if (!/^[a-z]{3,15}$/.test(singleWord)) return null;
    return singleWord;
  }
  function cleanupStreamerSession(cleanUsername, reason = "logout") {
    const session = activeStreamers.get(cleanUsername);
    if (!session) return;
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }
    if (session.conn) {
      try {
        session.conn.removeAllListeners();
        session.conn.disconnect();
      } catch {
      }
      session.conn = null;
    }
    session.desiredLiveUsername = null;
    session.status.connected = false;
    session.status.username = null;
    session.currentRoomId = null;
    io.to(`streamer:${cleanUsername}`).emit("tiktok-disconnected");
    io.to(`streamer:${cleanUsername}`).emit("tiktok-status", session.status);
    if (reason === "inactivity") {
      io.to(`streamer:${cleanUsername}`).emit("streamer-timeout", {
        reason: "inactivity",
        message: "Logged out after 20 minutes of inactivity (no chat or user activity)"
      });
    }
    for (const [ws, meta] of clients.entries()) {
      if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "tiktok:status",
            status: session.status
          })
        );
        if (reason === "inactivity") {
          ws.send(
            JSON.stringify({
              type: "streamer:timeout",
              message: "Logged out after 20 minutes of inactivity"
            })
          );
        }
      }
    }
    activeStreamers.delete(cleanUsername);
  }
  setInterval(() => {
    const now = Date.now();
    const INACTIVITY_MS = 20 * 60 * 1e3;
    for (const [username, session] of activeStreamers.entries()) {
      if (now - session.lastActivity >= INACTIVITY_MS) {
        cleanupStreamerSession(username, "inactivity");
      }
    }
  }, 15e3);
  function handleStreamerChatInGame(cleanUsername, rawData) {
    const session = activeStreamers.get(cleanUsername);
    if (!session) return;
    const data = normalizeChatData(rawData);
    if (!data.comment) return;
    session.status.chatEventsProcessed += 1;
    session.lastActivity = Date.now();
    const finder = {
      displayName: data.nickname || data.uniqueId,
      platform: "tiktok",
      platformUserId: `tt_${data.uniqueId}`,
      profileImage: data.profilePictureUrl || void 0
    };
    const singleWord = extractSingleWordFromChat(data.comment);
    if (!singleWord) {
      const item2 = {
        id: `tt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        platform: "tiktok",
        username: data.uniqueId,
        displayName: finder.displayName,
        profileImage: finder.profileImage || void 0,
        comment: data.comment,
        guessResult: "chat",
        timestamp: Date.now(),
        eventType: "chat"
      };
      session.chatHistory.push(item2);
      if (session.chatHistory.length > 50) session.chatHistory.shift();
      io.to(`streamer:${cleanUsername}`).emit("chat-message", item2);
      for (const [ws, meta] of clients.entries()) {
        if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "chat:event", item: item2 }));
          ws.send(JSON.stringify({ type: "tiktok:status", status: session.status }));
        }
      }
      return;
    }
    const bestOutcome = multiplayerGame.guess(singleWord, finder);
    session.status.guessesFromChat += 1;
    if (bestOutcome.result === "correct") {
      broadcastToMode("multiplayer", {
        type: "game:word-found",
        outcome: bestOutcome
      });
    }
    const item = {
      id: `tt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      platform: "tiktok",
      username: data.uniqueId,
      displayName: finder.displayName,
      profileImage: finder.profileImage || void 0,
      comment: data.comment,
      guessResult: bestOutcome.result === "too_short" ? "chat" : bestOutcome.result,
      points: bestOutcome.result === "correct" ? bestOutcome.points : void 0,
      isTitleWord: bestOutcome.isTitleWord,
      tierName: bestOutcome.tierName,
      timestamp: Date.now(),
      eventType: "chat"
    };
    session.chatHistory.push(item);
    if (session.chatHistory.length > 50) session.chatHistory.shift();
    io.to(`streamer:${cleanUsername}`).emit("chat-message", item);
    for (const [ws, meta] of clients.entries()) {
      if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "chat:event", item }));
        ws.send(JSON.stringify({ type: "tiktok:status", status: session.status }));
      }
    }
    broadcastToMode("multiplayer", {
      type: "game:state",
      state: multiplayerGame.publicState()
    });
    if (multiplayerGame.isComplete()) {
      scheduleRoundRollover("multiplayer");
    }
  }
  function handleStreamerLikeInGame(cleanUsername, rawData) {
    const session = activeStreamers.get(cleanUsername);
    if (!session) return;
    const data = normalizeLikeData(rawData);
    session.status.likesCount += data.likeCount;
    session.lastActivity = Date.now();
    const finder = {
      displayName: data.nickname || data.uniqueId,
      platform: "tiktok",
      platformUserId: `tt_${data.uniqueId}`,
      profileImage: data.profilePictureUrl || void 0
    };
    multiplayerGame.recordEngagement(finder, "like", data.likeCount);
    io.to(`streamer:${cleanUsername}`).emit("like-event", data);
    for (const [ws, meta] of clients.entries()) {
      if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "tiktok:status", status: session.status }));
      }
    }
  }
  function handleStreamerGiftInGame(cleanUsername, rawData) {
    const session = activeStreamers.get(cleanUsername);
    if (!session) return;
    const data = normalizeGiftData(rawData);
    const totalDiamonds = data.diamondCount * data.repeatCount;
    session.status.giftsDiamonds += totalDiamonds;
    session.lastActivity = Date.now();
    const finder = {
      displayName: data.nickname || data.uniqueId,
      platform: "tiktok",
      platformUserId: `tt_${data.uniqueId}`,
      profileImage: data.profilePictureUrl || void 0
    };
    multiplayerGame.recordEngagement(finder, "gift", totalDiamonds);
    io.to(`streamer:${cleanUsername}`).emit("gift-event", data);
    for (const [ws, meta] of clients.entries()) {
      if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "tiktok:status", status: session.status }));
      }
    }
  }
  function startStreamerConnection(cleanUsername, requestingSocket) {
    const session = activeStreamers.get(cleanUsername);
    if (!session) {
      if (requestingSocket) {
        requestingSocket.emit("tiktok-error", "Streamer session not found. Please log in first.");
      }
      return;
    }
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }
    if (session.conn && session.status.connected && session.status.username?.toLowerCase() === cleanUsername.toLowerCase()) {
      const payload = {
        username: session.status.username,
        roomId: session.currentRoomId || "live"
      };
      if (requestingSocket) requestingSocket.emit("tiktok-connected", payload);
      io.to(`streamer:${cleanUsername}`).emit("tiktok-connected", payload);
      io.to(`streamer:${cleanUsername}`).emit("tiktok-status", session.status);
      return;
    }
    if (session.conn) {
      try {
        session.conn.removeAllListeners();
        session.conn.disconnect();
      } catch {
      }
      session.conn = null;
    }
    session.desiredLiveUsername = cleanUsername;
    const conn = new WebcastPushConnection2(cleanUsername);
    session.conn = conn;
    conn.connect().then((state) => {
      if (session.conn !== conn) return;
      const roomId = String(state?.roomId || state?.roomInfo?.id || "live");
      session.currentRoomId = roomId;
      session.status.connected = true;
      session.status.mode = "tiktok-live";
      session.status.username = cleanUsername;
      session.status.lastError = null;
      session.lastActivity = Date.now();
      const payload = { username: cleanUsername, roomId };
      if (requestingSocket) requestingSocket.emit("tiktok-connected", payload);
      io.to(`streamer:${cleanUsername}`).emit("tiktok-connected", payload);
      io.to(`streamer:${cleanUsername}`).emit("tiktok-status", session.status);
      for (const [ws, meta] of clients.entries()) {
        if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "tiktok:status",
              status: session.status
            })
          );
        }
      }
    }).catch((err) => {
      if (session.conn !== conn) return;
      const errMsg = err?.message || String(err);
      session.status.connected = false;
      session.status.lastError = errMsg;
      if (requestingSocket) requestingSocket.emit("tiktok-error", errMsg);
      io.to(`streamer:${cleanUsername}`).emit("tiktok-status", session.status);
    });
    conn.on("chat", (data) => {
      if (session.conn !== conn) return;
      handleStreamerChatInGame(cleanUsername, data);
    });
    conn.on("like", (data) => {
      if (session.conn !== conn) return;
      handleStreamerLikeInGame(cleanUsername, data);
    });
    conn.on("gift", (data) => {
      if (session.conn !== conn) return;
      handleStreamerGiftInGame(cleanUsername, data);
    });
    conn.on("disconnected", () => {
      if (session.conn !== conn) return;
      if (session.desiredLiveUsername === cleanUsername) {
        session.reconnectTimer = setTimeout(() => {
          if (session.desiredLiveUsername === cleanUsername) {
            startStreamerConnection(cleanUsername);
          }
        }, 2500);
        return;
      }
      session.status.connected = false;
      session.currentRoomId = null;
      io.to(`streamer:${cleanUsername}`).emit("tiktok-disconnected");
      io.to(`streamer:${cleanUsername}`).emit("tiktok-status", session.status);
    });
    conn.on("error", (err) => {
      if (session.conn !== conn) return;
      if (!session.status.connected && requestingSocket) {
        requestingSocket.emit("tiktok-error", err?.message || String(err));
      }
    });
  }
  io.on("connection", (socket) => {
    socket.on("register-streamer", (payload) => {
      const username = cleanStreamerUsername(payload?.username);
      if (!username) return;
      socket.join(`streamer:${username}`);
      const session = activeStreamers.get(username);
      if (session) {
        session.lastActivity = Date.now();
        socket.emit("tiktok-status", session.status);
        if (session.status.connected) {
          socket.emit("tiktok-connected", {
            username: session.username,
            roomId: session.currentRoomId || "live"
          });
        }
      }
    });
    socket.on("connect-tiktok", (payload) => {
      try {
        const raw = typeof payload === "object" && payload !== null ? payload.username : payload;
        const key = typeof payload === "object" && payload !== null ? payload.key : void 0;
        const sessionId = typeof payload === "object" && payload !== null ? payload.sessionId : "";
        const cleanUsername = cleanStreamerUsername(raw);
        if (!cleanUsername) {
          socket.emit("tiktok-error", "Please enter a valid TikTok username");
          return;
        }
        if (!isStreamerAuthorized(cleanUsername, key)) {
          socket.emit(
            "tiktok-error",
            `@${cleanUsername} is not in the list of authorized streamers, or the access key is invalid.`
          );
          return;
        }
        socket.join(`streamer:${cleanUsername}`);
        let session = activeStreamers.get(cleanUsername);
        if (!session) {
          session = createDefaultStreamerSession(cleanUsername, sessionId || socket.id);
          activeStreamers.set(cleanUsername, session);
        }
        session.lastActivity = Date.now();
        startStreamerConnection(cleanUsername, socket);
      } catch (err) {
        socket.emit("tiktok-error", err?.message || String(err));
      }
    });
    socket.on("disconnect-tiktok", (payload) => {
      const rawUser = typeof payload === "object" && payload !== null ? payload.username : payload;
      const cleanUsername = cleanStreamerUsername(rawUser);
      if (cleanUsername) {
        const session = activeStreamers.get(cleanUsername);
        if (session) {
          if (session.reconnectTimer) {
            clearTimeout(session.reconnectTimer);
            session.reconnectTimer = null;
          }
          if (session.conn) {
            try {
              session.conn.removeAllListeners();
              session.conn.disconnect();
            } catch {
            }
            session.conn = null;
          }
          session.desiredLiveUsername = null;
          session.status.connected = false;
          session.currentRoomId = null;
          socket.emit("tiktok-disconnected");
          io.to(`streamer:${cleanUsername}`).emit("tiktok-disconnected");
          io.to(`streamer:${cleanUsername}`).emit("tiktok-status", session.status);
        }
      }
    });
    socket.on("chat-message", (data) => {
      const streamerUser = cleanStreamerUsername(data?.streamerUsername || data?.streamer);
      if (streamerUser && activeStreamers.has(streamerUser)) {
        handleStreamerChatInGame(streamerUser, data);
      }
    });
    socket.on("like-event", (data) => {
      const streamerUser = cleanStreamerUsername(data?.streamerUsername || data?.streamer);
      if (streamerUser && activeStreamers.has(streamerUser)) {
        handleStreamerLikeInGame(streamerUser, data);
      }
    });
    socket.on("gift-event", (data) => {
      const streamerUser = cleanStreamerUsername(data?.streamerUsername || data?.streamer);
      if (streamerUser && activeStreamers.has(streamerUser)) {
        handleStreamerGiftInGame(streamerUser, data);
      }
    });
  });
  async function getOrCreateSoloGame(sessionId, mode) {
    const key = `${sessionId}:${mode}`;
    let existing = soloGames.get(key);
    if (!existing) {
      const seed = mode === "daily-solo" ? getTodaySeed() : void 0;
      existing = await createNewGameInstance(mode, seed);
      soloGames.set(key, existing);
    }
    return existing;
  }
  async function getGameForClient(meta) {
    if (meta.mode === "multiplayer") return multiplayerGame;
    if (meta.mode === "wikiword-4x4") return wikiword4x4Game;
    return getOrCreateSoloGame(meta.sessionId, meta.mode);
  }
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      tiktok: tiktokStatus,
      presence: getViewerPresence()
    });
  });
  app.get("/api/admin/authorized-users", (_req, res) => {
    res.json({
      ok: true,
      users: authorizedUsers
    });
  });
  app.post("/api/admin/authorized-users", (req, res) => {
    try {
      const incoming = req.body?.users;
      if (!Array.isArray(incoming)) {
        return res.status(400).json({ ok: false, error: "Expected an array of authorized users" });
      }
      const validList = incoming.map((u) => ({
        username: cleanStreamerUsername(u?.username),
        key: String(u?.key || "").trim(),
        label: String(u?.label || "").trim() || void 0,
        createdAt: Number(u?.createdAt) || Date.now()
      })).filter((u) => u.username.length > 0 && u.key.length > 0);
      const deduped = [];
      const seen = /* @__PURE__ */ new Set();
      for (const u of validList) {
        if (!seen.has(u.username)) {
          seen.add(u.username);
          deduped.push(u);
        }
      }
      authorizedUsers = deduped;
      res.json({ ok: true, users: authorizedUsers });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });
  app.post("/api/auth/validate-streamer", (req, res) => {
    const rawUsername = req.body?.username;
    const rawKey = req.body?.key;
    const sessionId = String(req.body?.sessionId || "").trim();
    const username = cleanStreamerUsername(rawUsername);
    const key = String(rawKey || "").trim();
    if (!username || !key) {
      return res.status(400).json({
        ok: false,
        valid: false,
        message: "Both TikTok username and admin-provided key are required"
      });
    }
    const found = authorizedUsers.find(
      (u) => cleanStreamerUsername(u.username) === username && String(u.key).trim() === key
    );
    if (!found) {
      return res.status(401).json({
        ok: false,
        valid: false,
        message: "Invalid username or access key. Contact administrator for authorization."
      });
    }
    const now = Date.now();
    const INACTIVITY_MS = 20 * 60 * 1e3;
    const existing = activeStreamers.get(username);
    if (existing) {
      const isStale = now - existing.lastActivity >= INACTIVITY_MS;
      if (isStale) {
        cleanupStreamerSession(username, "inactivity");
      } else if (sessionId && existing.sessionId && existing.sessionId !== sessionId) {
        return res.status(409).json({
          ok: false,
          valid: false,
          isAlreadyLoggedIn: true,
          message: `@${found.username} is already logged in on another device or window. Multiple simultaneous logins under the same @username are not permitted.`
        });
      }
    }
    let session = activeStreamers.get(username);
    if (!session) {
      session = createDefaultStreamerSession(username, sessionId || `sess_${Date.now()}`);
      activeStreamers.set(username, session);
    } else {
      if (sessionId) session.sessionId = sessionId;
      session.lastActivity = now;
    }
    res.json({
      ok: true,
      valid: true,
      sessionId: session.sessionId,
      token: session.token,
      user: {
        username: found.username,
        label: found.label
      }
    });
  });
  app.post("/api/auth/streamer-activity", (req, res) => {
    try {
      const username = cleanStreamerUsername(req.body?.username);
      const sessionId = String(req.body?.sessionId || "").trim();
      if (!username) {
        return res.status(400).json({ ok: false, message: "Username required" });
      }
      const session = activeStreamers.get(username);
      if (session) {
        if (!sessionId || !session.sessionId || session.sessionId === sessionId) {
          session.lastActivity = Date.now();
          return res.json({ ok: true, lastActivity: session.lastActivity });
        }
      }
      res.json({ ok: false });
    } catch {
      res.json({ ok: false });
    }
  });
  app.post("/api/auth/streamer-logout", (req, res) => {
    try {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
        }
      }
      const rawUser = body?.username;
      const sessionId = String(body?.sessionId || "").trim();
      const username = cleanStreamerUsername(rawUser);
      if (username) {
        const session = activeStreamers.get(username);
        if (session) {
          if (!sessionId || !session.sessionId || session.sessionId === sessionId) {
            cleanupStreamerSession(username, "logout");
          }
        }
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });
  app.post("/api/admin/login", (req, res) => {
    const rawUser = String(req.body?.username || "").trim();
    const rawPass = String(req.body?.password || "").trim();
    if (rawUser.toLowerCase() === adminCredentials.username.toLowerCase() && rawPass === adminCredentials.password) {
      res.json({
        ok: true,
        username: adminCredentials.username,
        token: `adm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      });
    } else {
      res.status(401).json({
        ok: false,
        message: "Invalid Admin username or password"
      });
    }
  });
  app.post("/api/admin/change-credentials", (req, res) => {
    const currentPass = String(req.body?.currentPassword || "").trim();
    const newUsername = String(req.body?.newUsername || "").trim();
    const newPassword = String(req.body?.newPassword || "").trim();
    if (currentPass !== adminCredentials.password) {
      return res.status(401).json({
        ok: false,
        message: "Current admin password is incorrect"
      });
    }
    if (!newUsername || newUsername.length < 2) {
      return res.status(400).json({
        ok: false,
        message: "New username must be at least 2 characters"
      });
    }
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({
        ok: false,
        message: "New password must be at least 4 characters"
      });
    }
    adminCredentials = {
      username: newUsername,
      password: newPassword
    };
    res.json({
      ok: true,
      username: adminCredentials.username,
      message: "Admin credentials updated successfully"
    });
  });
  app.get("/api/tiktok/sample-words", (_req, res) => {
    const unfoundTitle = multiplayerGame.titleWords.filter(
      (w) => !multiplayerGame.revealedTitleWords.has(w)
    );
    const unfoundCommon = Array.from(multiplayerGame.commonWords.keys()).filter((w) => !multiplayerGame.foundWords.has(w)).slice(0, 6);
    const unfoundRare = Array.from(multiplayerGame.rareWords.keys()).filter((w) => !multiplayerGame.foundWords.has(w)).slice(0, 4);
    res.json({
      titleWords: unfoundTitle,
      commonWords: unfoundCommon,
      rareWords: unfoundRare
    });
  });
  wss.on("connection", (ws) => {
    const defaultMeta = {
      ws,
      sessionId: `anon-${Math.random().toString(36).slice(2, 10)}`,
      displayName: "Explorer",
      mode: "multiplayer"
    };
    clients.set(ws, defaultMeta);
    ws.send(
      JSON.stringify({
        type: "init",
        state: multiplayerGame.publicState(),
        tiktokStatus,
        chatHistory: liveChatHistory,
        presence: getViewerPresence()
      })
    );
    broadcastAll({
      type: "presence:update",
      presence: getViewerPresence()
    });
    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const meta = clients.get(ws);
        if (!meta) return;
        if (msg.type === "streamer:identify") {
          if (msg.streamerUsername !== void 0) {
            meta.streamerUsername = msg.streamerUsername ? cleanStreamerUsername(msg.streamerUsername) : null;
          }
          if (meta.streamerUsername) {
            const session = activeStreamers.get(meta.streamerUsername);
            if (session) {
              session.lastActivity = Date.now();
              ws.send(
                JSON.stringify({
                  type: "tiktok:status",
                  status: session.status
                })
              );
              if (session.chatHistory.length > 0) {
                for (const item of session.chatHistory) {
                  ws.send(JSON.stringify({ type: "chat:event", item }));
                }
              }
            }
          }
          return;
        }
        if (msg.type === "identify") {
          if (msg.sessionId) meta.sessionId = String(msg.sessionId).slice(0, 64);
          if (msg.displayName) meta.displayName = String(msg.displayName).trim().slice(0, 28) || "Explorer";
          if (msg.mode && ["multiplayer", "daily-solo", "practice-solo", "wikiword-4x4"].includes(msg.mode)) {
            meta.mode = msg.mode;
          }
          if (msg.streamerUsername !== void 0) {
            meta.streamerUsername = msg.streamerUsername ? cleanStreamerUsername(msg.streamerUsername) : null;
          }
          if (meta.streamerUsername) {
            const session = activeStreamers.get(meta.streamerUsername);
            if (session) {
              session.lastActivity = Date.now();
              ws.send(
                JSON.stringify({
                  type: "tiktok:status",
                  status: session.status
                })
              );
              if (session.chatHistory.length > 0) {
                for (const item of session.chatHistory) {
                  ws.send(JSON.stringify({ type: "chat:event", item }));
                }
              }
            }
          }
          const game = await getGameForClient(meta);
          ws.send(
            JSON.stringify({
              type: "game:state",
              state: game.publicState()
            })
          );
          broadcastAll({
            type: "presence:update",
            presence: getViewerPresence()
          });
          return;
        }
        if (msg.type === "streamer:activity") {
          if (meta.streamerUsername) {
            const session = activeStreamers.get(meta.streamerUsername);
            if (session) {
              session.lastActivity = Date.now();
            }
          }
          return;
        }
        if (msg.type === "mode:switch") {
          const nextMode = msg.mode;
          if (["multiplayer", "daily-solo", "practice-solo", "wikiword-4x4"].includes(nextMode)) {
            meta.mode = nextMode;
            const game = await getGameForClient(meta);
            ws.send(
              JSON.stringify({
                type: "game:state",
                state: game.publicState()
              })
            );
            broadcastAll({
              type: "presence:update",
              presence: getViewerPresence()
            });
          }
          return;
        }
        if (msg.type === "guess:submit") {
          const singleWord = extractSingleWordFromChat(String(msg.word || ""));
          if (!singleWord) return;
          const finder = {
            displayName: meta.displayName,
            platform: "web",
            platformUserId: meta.sessionId
          };
          const game = await getGameForClient(meta);
          const outcome = game.guess(singleWord, finder);
          ws.send(
            JSON.stringify({
              type: "guess:result",
              outcome
            })
          );
          if (meta.mode === "multiplayer" && outcome.result !== "too_short") {
            pushLiveChatItem({
              id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              platform: "web",
              username: meta.displayName.toLowerCase().replace(/\s+/g, "_"),
              displayName: meta.displayName,
              comment: outcome.word.toUpperCase(),
              guessResult: outcome.result,
              points: outcome.points,
              isTitleWord: outcome.isTitleWord,
              tierName: outcome.tierName,
              timestamp: Date.now(),
              eventType: "chat"
            });
          }
          if (meta.mode === "multiplayer" || meta.mode === "wikiword-4x4") {
            if (outcome.result === "correct") {
              broadcastToMode(meta.mode, {
                type: "game:word-found",
                outcome
              });
            }
            broadcastToMode(meta.mode, {
              type: "game:state",
              state: game.publicState()
            });
            if (game.isComplete()) {
              scheduleRoundRollover(meta.mode);
            }
          } else {
            ws.send(
              JSON.stringify({
                type: "game:state",
                state: game.publicState()
              })
            );
          }
          return;
        }
        if (msg.type === "game:hint") {
          const game = await getGameForClient(meta);
          const hint = game.requestHint();
          if (meta.mode === "multiplayer" || meta.mode === "wikiword-4x4") {
            broadcastToMode(meta.mode, {
              type: "game:state",
              state: game.publicState()
            });
          } else {
            ws.send(
              JSON.stringify({
                type: "game:state",
                state: game.publicState(),
                hint
              })
            );
          }
          return;
        }
        if (msg.type === "game:new-round") {
          if (meta.mode === "multiplayer") {
            if (mpCountdownInterval) {
              clearInterval(mpCountdownInterval);
              mpCountdownInterval = null;
            }
            multiplayerGame = await createNewGameInstance("multiplayer");
            broadcastToMode("multiplayer", {
              type: "game:state",
              state: multiplayerGame.publicState()
            });
          } else if (meta.mode === "wikiword-4x4") {
            if (wwCountdownInterval) {
              clearInterval(wwCountdownInterval);
              wwCountdownInterval = null;
            }
            wikiword4x4Game = await createNewGameInstance("wikiword-4x4");
            broadcastToMode("wikiword-4x4", {
              type: "game:state",
              state: wikiword4x4Game.publicState()
            });
          } else {
            const key = `${meta.sessionId}:${meta.mode}`;
            const seed = meta.mode === "daily-solo" && !msg.forceNewArticle ? getTodaySeed() : void 0;
            const fresh = await createNewGameInstance(meta.mode, seed);
            soloGames.set(key, fresh);
            ws.send(
              JSON.stringify({
                type: "game:state",
                state: fresh.publicState()
              })
            );
          }
          return;
        }
      } catch (err) {
        console.error("[WS Error]", err);
      }
    });
    ws.on("close", () => {
      const closedMeta = clients.get(ws);
      clients.delete(ws);
      broadcastAll({
        type: "presence:update",
        presence: getViewerPresence()
      });
      if (closedMeta?.streamerUsername) {
        const streamerUser = closedMeta.streamerUsername;
        setTimeout(() => {
          let hasOtherStreamerWs = false;
          for (const remaining of clients.values()) {
            if (remaining.streamerUsername === streamerUser) {
              hasOtherStreamerWs = true;
              break;
            }
          }
          if (!hasOtherStreamerWs) {
            cleanupStreamerSession(streamerUser, "window_close");
          }
        }, 3500);
      }
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false
      },
      plugins: [
        {
          name: "disable-vite-hmr-ws",
          enforce: "post",
          transform(code, id) {
            if (id.includes("client.mjs") || code.includes("createWebSocketModuleRunnerTransport")) {
              return code.replace(
                /transport\.connect\(createHMRHandler\(handleMessage\)\);/g,
                "/* hmr disabled */"
              ).replace(
                /setupForwardConsoleHandler\(transport,\s*forwardConsole\);/g,
                "/* console forward disabled */"
              );
            }
          }
        }
      ],
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`WiKirecTangled Live & Solo Server running on http://localhost:${PORT}`);
  });
}
startServer();
