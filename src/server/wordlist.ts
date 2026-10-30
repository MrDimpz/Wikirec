export class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isWord = false;
}

export class Trie {
  root = new TrieNode();
  wordCount = 0;

  insert(word: string) {
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

  has(word: string): boolean {
    let node = this.root;
    for (const ch of word) {
      const next = node.children.get(ch);
      if (!next) return false;
      node = next;
    }
    return node.isWord;
  }

  hasPrefix(prefix: string): boolean {
    let node = this.root;
    for (const ch of prefix) {
      const next = node.children.get(ch);
      if (!next) return false;
      node = next;
    }
    return true;
  }
}

export const STOPLIST = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'of', 'to', 'in',
  'on', 'at', 'by', 'for', 'with', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'am', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would',
  'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'this', 'that',
  'these', 'those', 'it', 'its', 'they', 'them', 'their', 'there', 'here',
  'he', 'she', 'we', 'you', 'your', 'his', 'her', 'him', 'me', 'my', 'our',
  'who', 'whom', 'whose', 'which', 'what', 'when', 'where', 'why', 'how',
  'not', 'no', 'so', 'than', 'too', 'very', 'just', 'also', 'such', 'into',
  'from', 'about', 'after', 'before', 'over', 'under', 'between', 'through',
  'during', 'while', 'because', 'although', 'though', 'since', 'until',
  'one', 'two', 'three', 'first', 'second', 'new', 'old', 'other',
  'some', 'any', 'all', 'each', 'every', 'most', 'many', 'much', 'more',
  'less', 'few', 'several', 'both', 'either', 'neither',
]);

// Curated high-frequency Common words (Zipf >= 4.2)
const COMMON_WORDS_RAW = `
time year people way day man thing woman life child world school state family student group country problem hand part place case week company system program question work government number night point home water room mother area money story fact month lot right study book eye job word business issue side kind head house service friend father power hour game line end member law car city community name president team minute idea kid body information back parent face others level office door health person art war history party result change morning reason research girl guy moment air teacher force education foot boy age policy process music market sense serviceplan college interest death experience effect use class control care field development role effort rate heart drug show leader light voice wife police mind price report decision son view relationship town road arm difference value building action model season society tax director position player agree record paper space ground form event official matter center couple site project hit base activity star table need court produce eat teach oil sytuations cost industry figure street image phone data picture practice piece land product doctor wall patient worker news test movie north love support technology step baby computer type attention film tree source organization choose look century evidence window difficult listen cultureillion plan আচরণ
able acid aged also area army away baby back ball band bank base bath bear beat bell belt best bill bird blow blue boat body bomb bond bone book boom枚 boot born boss both bowl bulk burn bush busy call calm came camp card care Carl case cash cast cell chat chip city clad claim clay clean clear club coal coat code cold come cook cool cope copy core cost crew crop dark data date dawn days dead deal dean dear debt deep deny desk dial dick diet disc disk does done door dose down draw drew drop drug dual duke dust duty each earn ease east easy edge else even ever evil exit face fact fail fair fall farm fast fate fear feed feel feet fell felt file fill film find fine fire firm fish five flat fled flew flowfood foot ford form fort four free from fuel full fund gain game gate gave gear gene gift girl give glad goal goes gold golf gone good gray grew grey grow gulf hair half hall hand hang hard harm hate have head hear heat held hell help here hero high hill hire hold hole holy home hope horn host hour huge hung hunt hurt idea inch into iron item jack jane jean john join jump jury just keen keep kent kept kick kill kind king knee knew know lack lady laid lake land lane last late lead left less life lift like line link list live load loan lock logo long look lord lose loss lost loud love luck made mail main make male mall many mark mass matt meal mean meat meet menu mere mess Emi mile milk mill mind mine miss mode mood moon more most move much must name navy near neck need news next nice nick nine none norm nose note okay once only onto open oral area
planet star galaxy orbit solar lunar eclipse comet asteroid meteor nebula cosmos gravity telescope rocket satellite launch shuttle station astronaut module probe crater surface atmosphere oxygen carbon nitrogen hydrogen heliumiron nickel copper silver gold metal crystal mineral rock stone magma lava volcano earthquake fault plate tectonic ocean sea wave tide current reef island coast shore beach sand cliff canyon valley river stream lake pond glacier ice snow rain cloud storm wind hurricane tornado climate weather season spring summer autumn winter forest woods jungle desert tundra meadow prairie savanna plant tree leaf root bark trunk branch seed flower petal pollen grass moss fern fungus mushroom animal mammal reptile amphibian bird insect spider fish shark whale dolphin seal otter bear wolf fox deer lion tiger leopard cheetah elephant rhino hippo giraffe zebra horse donkey camel sheep goat pig cow bull dog cat mouse rat squirrel rabbit hare bat eagle hawk owl falcon parrot penguin swan duck goose frog toad snake lizard turtle crocodile alligator crab lobster shrimp octopus squid snail worm bee wasp ant butterfly moth beetle fly mosquito
science physics chemistry biology astronomy geology ecology genetics evolution anatomy medicine surgery vaccine virus bacteria cell tissue organ brain heart lung liver kidney stomach muscle bone nerve blood artery vein artery hormone enzyme protein vitamin mineral calorie nutrient diet exercise fitness sport game match tournament league champion medal trophy score goal point pass shot kick throw catch run jump swim dive cycle race track court field stadium arena gym pool coach referee fan crowd team club player captain uniform helmet glove boot racket bat ball net post ring bell whistle clock timer watch calendar schedule planner journal diary letter note page chapter volume library archive museum gallery theater cinema stage screen actor actress director producer writer author poet artist painter sculptor composer musician singer dancer orchestra band choir symphony concert opera ballet drama comedy tragedy novel poem essay article review biography history legend myth folklore tradition custom culture language dialect alphabet grammar vocabulary dictionary encyclopedia translation
`.trim().split(/\s+/);

// Rare encyclopedic words (3.0 <= Zipf < 4.2)
const RARE_WORDS_RAW = `
alchemy archive artifact asteroid aurora basilica biosphere broccoli calligraphy catapult cathedral centrifuge chronicle citadel clarinet Cobalt coliseum compass concerto conduit constellation corridor crucible cryptogram curvature cylinder cypress labyrinth latitude longitude magnetism manuscript marathon mechanism meridian metaphor meteorite microbes millennium mineralogy monolith季 monument mosaic nebula obsidian odometerelisk orchestra origami paradigm paradox parchment pavilion pendulum peninsula pergola permafrost petroglyph phenomenon phoneme photon pinnacle plankton plateau polarity porcelain portcullis positron precipice predator prelude prism prodigy prophecy protocol pulsar pyramid quadrant quarantineasar quaternion quicksilver quintessence radiation barometer biosphere boulevard cartography catalyst cavern celestial chameleon chandelier charisma chronicleinnamon cipher cloister coalescent cobblestone colloquium combustion compendium concentric confluence conservatory contagion continuum contraband conundrum convection copernican corollary cosmogony cosmology counterweight cratered crescendo crystalline culinary curvature cybernetic cyclotron
archipelago bioluminescence luminescence photosynthesis chemosynthesis metamorphosis symbiosis osmosis diffusion refraction diffraction interference polarization spectroscopy chromatography electrophoresis centrifugation distillation calcination sublimation condensation evaporation precipitation crystallization polymerization fermentation pasteurization sterilization immunization vaccination inoculation gestation hibernation estivation migration echolocation navigation triangulation radiolarian foraminifera stromatolite trilobite ammonite archaeopteryx megalodon mastodon mammoth sabertooth Neanderthal Paleolithic Mesolithic Neolithic Bronze Iron Antiquity Medieval Renaissance Enlightenment Industrial Modern Postmodern Romanticism Impressionism Expressionism Cubism Surrealism Futurism Minimalism Brutalism Baroque Rococo Gothic Neoclassical Byzantine Romanesque Ottoman Mughal Ming Qing Tokugawa Meiji Hellenistic Ptolemaic Seleucid Maurya Gupta Abbasid Umayyad Fatimid Mamluk Safavid Timurid Carolingian Merovingian Plantagenet Tudor Stuart Habsburg Romanov Bourbon
`.trim().split(/\s+/);

// Ultra-rare words (Zipf < 3.0)
const ULTRA_WORDS_RAW = `
abiogenesis archaeoastronomy bathyscaphe birefringence biostratigraphy chromatophore chronolect circumvallation clathrate coccolithophore cryovolcanism dendrochronology диагенез eigenstate electroreception endosymbiosis epiphenomenon estremophile euchromatin exobiology ferromagnetism fluorophore geochronology glottochronology gravitropism halophile heliophysics hemocyanin heterochromatin hydrostatics hyperfine ichnology ignimbrite interferometry isostasy karyotype kymograph libration lithification magnetosphere mechanoreception megafauna magnetohydrodynamics metasomatism microgravity мімесис morphogen mycorrhiza nucleosynthesis oceanography odontocete olfaction ommatidium ontogeny ophiolite organogenesis paleoclimatology paleomagnetism palynology panspermia parsec pathognomonic pedogenesis perihelion petrology piezoelectrics planimal plasmonics pleiotropy pneumatophore poikilotherm polynyas protostar pyroclastic radiolaria regolith rheology SapirWhorf seismology selenography sericulture solifluction sonoluminescence spallation speleology stoichiometrics stratigraphy stromatolites superfluidity synapomorphy taphonomy technosignature tektite thermocline thermohaline thigmotropism tokamak triboluminescence тропосфера vitrification xenolith zeugma zoogeography
quasar pulsar magnetar blazar neutron baryon lepton boson hadron quark gluon tachyon neutrino graviton antimatter singularity eventhorizon Schwarzschild Hawking Chandrasekhar Oppenheimer Feynman Dirac Schrodinger Heisenberg Planck Maxwell Faraday Ampere Volta Ohm Joule Watt Kelvin Celsius Fahrenheit Rankine Avogadro Boltzmann Doppler Coriolis Foucault Mercator Fibonacci Euclid Pythagoras Archimedes Eratosthenes Hipparchus Ptolemy Copernicus Kepler Galileo Newton Leibniz Euler Gauss Riemann Lobachevsky Poincaré Hilbert Gödel Turing Shannon VonNeumann Lovelace Babbage Boole DeMorgan Venn Bayes Markov MonteCarlo Fourier Laplace Lagrange Legendre Bessel Chebyshev Hermite Hyperbola Parabola Ellipse Cycloid Epicycloid Catenary Brachistochrone Tautochrone KleinMoebius Torus Polyhedron Tetrahedron Octahedron Dodecahedron Icosahedron Tesseract Simplex Manifold Topology Homology Cohomology Homotopy Isomorphism Homeomorphism Diffeomorphism Automorphism Endomorphism Epimorphism Monomorphism Functor Monad Groupoid Semigroup Monoid Quasigroup Loop Ring Field Module Vector Tensor Spinor Bivector Multivector Clifford Grassmann LieAlgebra
`.trim().split(/\s+/);

// Additional 3-7 letter common grid building blocks so 8-connected grids always have rich solvable paths
const GRID_CORE_WORDS = `
ace act add age ago aid aim air ale all amp and ant any ape apt arc are ark arm art ash ask ate awe axe
bad bag ban bar bat bay bed bee beg bet bid big bin bit契 bow box boy bra bud bug bum bun bus but buy
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

export interface WikiArticleSeed {
  title: string;
  category: string;
  extract: string;
  url: string;
  titleWords: string[];
  keywords: string[];
}

export const CURATED_WIKI_ARTICLES: WikiArticleSeed[] = [
  {
    title: 'Solar Eclipse Phenomenon',
    category: 'Astronomy & Space',
    extract: 'A solar eclipse occurs when the Moon passes between Earth and the Sun, obscuring the view of the Sun from a small part of the Earth, either totally or partially. During totality, the solar corona shimmers in the darkened sky while diamond ring effects appear along the lunar limb.',
    url: 'https://en.wikipedia.org/wiki/Solar_eclipse',
    titleWords: ['solar', 'eclipse', 'phenomenon'],
    keywords: ['moon', 'earth', 'sun', 'shadow', 'corona', 'orbit', 'lunar', 'light', 'totality', 'planet', 'sky', 'star', 'dark', 'ring', 'phase', 'align', 'space', 'view', 'time', 'path'],
  },
  {
    title: 'Great Barrier Coral Reef',
    category: 'Marine Ecology',
    extract: 'The Great Barrier Reef is the world largest coral reef system composed of over two thousand individual reefs and nine hundred islands stretching across the Coral Sea off the coast of Queensland, Australia. Built by billions of tiny organisms known as coral polyps, it supports extraordinary marine biodiversity.',
    url: 'https://en.wikipedia.org/wiki/Great_Barrier_Reef',
    titleWords: ['great', 'barrier', 'coral', 'reef'],
    keywords: ['ocean', 'sea', 'island', 'coast', 'water', 'marine', 'fish', 'shark', 'whale', 'turtle', 'sand', 'wave', 'tide', 'shell', 'life', 'dive', 'deep', 'blue', 'warm', 'tropics'],
  },
  {
    title: 'Ancient Library of Alexandria',
    category: 'Ancient History',
    extract: 'The Great Library of Alexandria in Egypt was one of the largest and most significant libraries of the ancient world. Functioning as a major center of Hellenistic scholarship under the Ptolemaic dynasty, it housed hundreds of thousands of papyrus scrolls covering mathematics, astronomy, literature, and medicine.',
    url: 'https://en.wikipedia.org/wiki/Library_of_Alexandria',
    titleWords: ['ancient', 'library', 'alexandria'],
    keywords: ['book', 'scroll', 'egypt', 'history', 'scholar', 'read', 'write', 'text', 'king', 'port', 'fire', 'stone', 'hall', 'study', 'wise', 'math', 'star', 'poet', 'greek', 'harbor'],
  },
  {
    title: 'Deep Ocean Hydrothermal Vent',
    category: 'Earth Sciences',
    extract: 'A hydrothermal vent is a fissure on the seafloor from which geothermally heated water issues. Commonly found near volcanically active places, areas where tectonic plates are moving apart at mid-ocean ridges, these dark chimneys host chemosynthetic bacteria and giant tube worms without sunlight.',
    url: 'https://en.wikipedia.org/wiki/Hydrothermal_vent',
    titleWords: ['deep', 'ocean', 'thermal', 'vent'],
    keywords: ['water', 'heat', 'steam', 'rock', 'magma', 'lava', 'plate', 'ridge', 'floor', 'dark', 'life', 'worm', 'crab', 'plume', 'mineral', 'iron', 'sulfur', 'core', 'crust', 'sea'],
  },
  {
    title: 'Northern Aurora Borealis Lights',
    category: 'Atmospheric Physics',
    extract: 'An aurora, often called the northern lights or aurora borealis, is a natural light display in Earth sky predominantly seen in high-latitude regions around the Arctic and Antarctic. Auroras display dynamic curtains, rays, spirals, and flickers caused by solar wind disturbances in the magnetosphere.',
    url: 'https://en.wikipedia.org/wiki/Aurora',
    titleWords: ['northern', 'aurora', 'lights'],
    keywords: ['sky', 'night', 'glow', 'green', 'solar', 'wind', 'pole', 'arctic', 'ice', 'snow', 'cold', 'star', 'field', 'storm', 'ray', 'band', 'wave', 'atom', 'gas', 'ion'],
  },
  {
    title: 'Mechanical Pendulum Clockwork',
    category: 'History of Technology',
    extract: 'A pendulum clock is a clock that uses a swinging weight as its timekeeping element. Invented by Christiaan Huygens in 1656 and inspired by Galileo Galilei investigations, pendulum escapement mechanisms reduced daily timekeeping error from fifteen minutes to bare seconds.',
    url: 'https://en.wikipedia.org/wiki/Pendulum_clock',
    titleWords: ['pendulum', 'clock', 'weight'],
    keywords: ['time', 'hour', 'minute', 'second', 'swing', 'gear', 'wheel', 'spring', 'bell', 'chime', 'hand', 'dial', 'face', 'tick', 'iron', 'brass', 'tower', 'watch', 'beat', 'rate'],
  },
  {
    title: 'Monarch Butterfly Migration',
    category: 'Entomology & Nature',
    extract: 'Monarch butterfly migration is the phenomenon in which millions of monarch butterflies travel thousands of miles across North America from southern Canada to overwintering mountain forests in central Mexico, navigating by a sun compass and circadian clock.',
    url: 'https://en.wikipedia.org/wiki/Monarch_butterfly_migration',
    titleWords: ['monarch', 'butterfly', 'migration'],
    keywords: ['wing', 'flight', 'insect', 'flower', 'plant', 'leaf', 'tree', 'forest', 'south', 'north', 'wind', 'sun', 'warm', 'cold', 'orange', 'black', 'gold', 'nest', 'egg', 'path'],
  },
  {
    title: 'Renaissance Printing Press Revolution',
    category: 'Media & History',
    extract: 'The movable-type printing press developed by Johannes Gutenberg in Mainz around 1440 transformed European society by enabling the mass production of printed books, accelerating the Renaissance, the Scientific Revolution, and vernacular literacy across continents.',
    url: 'https://en.wikipedia.org/wiki/Printing_press',
    titleWords: ['printing', 'press', 'revolution'],
    keywords: ['book', 'page', 'paper', 'ink', 'type', 'metal', 'lead', 'word', 'read', 'write', 'text', 'letter', 'frame', 'screw', 'wood', 'shop', 'trade', 'city', 'idea', 'news'],
  },
  {
    title: 'Volcanic Caldera Eruption',
    category: 'Volcanology',
    extract: 'A caldera is a large cauldron-like hollow that forms shortly after the emptying of a magma chamber in a volcanic eruption. When huge volumes of magma are erupted over a short time, structural support for the rock above the chamber is lost, and the ground surface collapses inward.',
    url: 'https://en.wikipedia.org/wiki/Caldera',
    titleWords: ['volcanic', 'caldera', 'eruption'],
    keywords: ['magma', 'lava', 'ash', 'rock', 'crater', 'fire', 'smoke', 'plume', 'cone', 'peak', 'lake', 'steam', 'vent', 'earth', 'crust', 'fault', 'blast', 'flow', 'stone', 'heat'],
  },
  {
    title: 'Transcontinental Steam Railway',
    category: 'Transport Engineering',
    extract: 'A transcontinental railroad is a contiguous network of railroad trackage that crosses a continental land mass with terminals at different oceans or continental borders, uniting distant regions through iron bridges, mountain tunnels, and steam locomotives.',
    url: 'https://en.wikipedia.org/wiki/Transcontinental_railroad',
    titleWords: ['steam', 'railway', 'network'],
    keywords: ['train', 'track', 'rail', 'iron', 'steel', 'coal', 'fire', 'wheel', 'engine', 'bridge', 'tunnel', 'pass', 'west', 'east', 'coast', 'town', 'city', 'road', 'line', 'car'],
  },
  {
    title: 'Symphony Orchestra Concert Hall',
    category: 'Music & Acoustics',
    extract: 'A symphony orchestra is a large instrumental ensemble typical of classical music, combining string, woodwind, brass, and percussion sections led by a conductor inside an acoustically tuned concert hall.',
    url: 'https://en.wikipedia.org/wiki/Orchestra',
    titleWords: ['symphony', 'orchestra', 'concert'],
    keywords: ['music', 'sound', 'stage', 'hall', 'string', 'horn', 'drum', 'flute', 'harp', 'note', 'tone', 'song', 'tune', 'chord', 'beat', 'tempo', 'play', 'band', 'choir', 'voice'],
  },
  {
    title: 'Voyager Interstellar Space Probe',
    category: 'Space Exploration',
    extract: 'The Voyager program launched twin robotic probes, Voyager 1 and Voyager 2, to study the outer planets Jupiter, Saturn, Uranus, and Neptune before crossing the heliopause into interstellar space carrying the Golden Record.',
    url: 'https://en.wikipedia.org/wiki/Voyager_program',
    titleWords: ['voyager', 'space', 'probe'],
    keywords: ['star', 'planet', 'orbit', 'moon', 'ring', 'saturn', 'jupiter', 'solar', 'radio', 'signal', 'disk', 'gold', 'record', 'earth', 'launch', 'rocket', 'flight', 'deep', 'craft', 'camera'],
  },
];

let cachedTrie: Trie | null = null;
let cachedFreqMap: Map<string, number> | null = null;

export function getFrequencyMap(): Map<string, number> {
  if (cachedFreqMap) return cachedFreqMap;
  const map = new Map<string, number>();

  for (const raw of GRID_CORE_WORDS) {
    const w = raw.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (w.length >= 3) map.set(w, 4.6);
  }
  for (const raw of COMMON_WORDS_RAW) {
    const w = raw.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (w.length >= 3) map.set(w, 4.8);
  }
  for (const raw of RARE_WORDS_RAW) {
    const w = raw.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (w.length >= 4) map.set(w, 3.5);
  }
  for (const raw of ULTRA_WORDS_RAW) {
    const w = raw.replace(/[^a-zA-Z]/g, '').toLowerCase();
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

export function getTrie(): Trie {
  if (cachedTrie) return cachedTrie;
  const trie = new Trie();
  const freq = getFrequencyMap();
  for (const word of freq.keys()) {
    trie.insert(word);
  }
  cachedTrie = trie;
  return trie;
}

export function singularizeForTitleAlias(word: string): string | null {
  const w = String(word || '').toLowerCase();
  if (w.length < 4) return null;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('es') && (w.endsWith('ches') || w.endsWith('shes') || w.endsWith('xes') || w.endsWith('ses'))) {
    return w.slice(0, -2);
  }
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) {
    return w.slice(0, -1);
  }
  return null;
}

// Fetch a real Wikipedia article or select a curated/seeded one
let recentArticleTitles = new Set<string>();

export async function fetchWikipediaRoundArticle(options?: {
  seedKey?: string;
  compactSingleWord?: boolean;
}): Promise<WikiArticleSeed> {
  const trie = getTrie();
  const freq = getFrequencyMap();

  if (options?.compactSingleWord) {
    const compactCandidates = [
      'planet', 'galaxy', 'eclipse', 'volcano', 'glacier', 'compass', 'library',
      'crystal', 'orchard', 'lantern', 'monarch', 'thunder', 'harbor', 'canyon',
      'pendulum', 'symphony', 'voyager', 'aurora', 'pyramid', 'citadel',
    ];
    const chosen = options.seedKey
      ? compactCandidates[Math.abs(hashCode(options.seedKey)) % compactCandidates.length]
      : compactCandidates[Math.floor(Math.random() * compactCandidates.length)];
    trie.insert(chosen);
    return {
      title: chosen.toUpperCase(),
      category: 'WikiWord 4×4 Target',
      extract: `Find the hidden target word (${chosen.length} letters) inside the 4×4 letter grid. Uncovering 75% of common words highlights the exact starting tile!`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(chosen)}`,
      titleWords: [chosen],
      keywords: [chosen],
    };
  }

  // Deterministic Daily Solo puzzle
  if (options?.seedKey) {
    const idx = Math.abs(hashCode(options.seedKey)) % CURATED_WIKI_ARTICLES.length;
    const base = CURATED_WIKI_ARTICLES[idx];
    registerArticleWordsInDictionary(base, trie, freq);
    return base;
  }

  // Try fetching a live random Wikipedia summary first (with fast 2200ms timeout)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2200);
    const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary', {
      headers: { 'User-Agent': 'WiKirecTangled/2.0 (WordTycoon Live Puzzle)' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const rawTitle = String(data.title || '').replace(/\s*\([^)]*\)\s*/g, '').trim();
      const extract = String(data.extract || '').trim();
      const words = (rawTitle.toLowerCase().match(/[a-z]+/g) || []).filter(
        (w) => w.length >= 4 && w.length <= 9 && !STOPLIST.has(w)
      );
      const uniqueTitleWords = Array.from(new Set(words)).slice(0, 4);
      if (
        uniqueTitleWords.length >= 2 &&
        extract.length >= 100 &&
        !recentArticleTitles.has(rawTitle)
      ) {
        recentArticleTitles.add(rawTitle);
        if (recentArticleTitles.size > 25) recentArticleTitles.clear();
        const extractTokens = (extract.toLowerCase().match(/[a-z]{4,10}/g) || []).filter(
          (w) => !STOPLIST.has(w)
        );
        const article: WikiArticleSeed = {
          title: rawTitle,
          category: data.description ? String(data.description).slice(0, 48) : 'Wikipedia Featured Article',
          extract,
          url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(rawTitle)}`,
          titleWords: uniqueTitleWords,
          keywords: Array.from(new Set(extractTokens)).slice(0, 30),
        };
        registerArticleWordsInDictionary(article, trie, freq);
        return article;
      }
    }
  } catch {
    // Fallback cleanly to curated encyclopedic articles
  }

  const available = CURATED_WIKI_ARTICLES.filter((a) => !recentArticleTitles.has(a.title));
  const pool = available.length > 0 ? available : CURATED_WIKI_ARTICLES;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  recentArticleTitles.add(picked.title);
  if (recentArticleTitles.size >= CURATED_WIKI_ARTICLES.length) {
    recentArticleTitles.clear();
  }
  registerArticleWordsInDictionary(picked, trie, freq);
  return picked;
}

function registerArticleWordsInDictionary(article: WikiArticleSeed, trie: Trie, freq: Map<string, number>) {
  for (const w of article.titleWords) {
    const clean = w.toLowerCase().replace(/[^a-z]/g, '');
    if (clean.length >= 3) {
      trie.insert(clean);
      if (!freq.has(clean)) freq.set(clean, 3.8);
    }
  }
  for (const w of article.keywords) {
    const clean = w.toLowerCase().replace(/[^a-z]/g, '');
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

export function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}
