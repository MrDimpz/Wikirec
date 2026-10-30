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

export interface SeasonalWikiArticleSeed extends WikiArticleSeed {
  seasonTag?: 'halloween' | 'christmas' | 'easter' | 'autumn' | 'winter' | 'spring' | 'summer' | 'general';
}

export const CURATED_WIKI_ARTICLES: SeasonalWikiArticleSeed[] = [
  // Halloween & Late October Curated Articles
  {
    title: 'Carved Jack Lantern Pumpkin',
    category: 'Halloween & Folklore',
    seasonTag: 'halloween',
    extract: 'A jack-o-lantern is a carved lantern, most commonly made from a pumpkin, turnip, or rutabaga, associated with the holiday of Halloween. Originating in Irish and Scottish folklore surrounding the legend of Stingy Jack and wandering spectral lights, carved pumpkins glow on doorsteps every October.',
    url: 'https://en.wikipedia.org/wiki/Jack-o%27-lantern',
    titleWords: ['carved', 'jack', 'lantern', 'pumpkin'],
    keywords: ['halloween', 'autumn', 'candle', 'flame', 'night', 'ghost', 'spirit', 'carve', 'seed', 'orange', 'gourd', 'harvest', 'october', 'light', 'dark', 'mask', 'treat', 'folklore', 'myth', 'glow'],
  },
  {
    title: 'Ancient Celtic Samhain Festival',
    category: 'Halloween & History',
    seasonTag: 'halloween',
    extract: 'Samhain is a Gaelic seasonal festival observed from sunset on October 31 to November 1, marking the end of the harvest season and the beginning of winter. In Celtic tradition, the boundary between this world and the Otherworld thinned at Samhain, inspiring bonfires, guising, and modern Halloween customs.',
    url: 'https://en.wikipedia.org/wiki/Samhain',
    titleWords: ['ancient', 'celtic', 'samhain', 'festival'],
    keywords: ['harvest', 'winter', 'autumn', 'fire', 'bonfire', 'feast', 'spirit', 'ghost', 'mask', 'costume', 'apple', 'nut', 'night', 'october', 'custom', 'folk', 'hearth', 'hill', 'flame', 'dark'],
  },
  {
    title: 'Gothic Vampire Folklore Legend',
    category: 'Folklore & Literature',
    seasonTag: 'halloween',
    extract: 'A vampire is a mythical creature in folklore that subsists by feeding on the vital essence of the living. Popularized in Gothic fiction by John Polidori and Bram Stoker classic novel Dracula, vampire legends blend Eastern European superstition with Victorian nocturnal mystery.',
    url: 'https://en.wikipedia.org/wiki/Vampire',
    titleWords: ['gothic', 'vampire', 'folklore', 'legend'],
    keywords: ['night', 'castle', 'bat', 'shadow', 'fang', 'cape', 'blood', 'moon', 'grave', 'crypt', 'coffins', 'garlic', 'silver', 'mirror', 'myth', 'novel', 'dark', 'count', 'mist', 'sleep'],
  },
  {
    title: 'Sleepy Hollow Headless Horseman',
    category: 'Autumn Folklore & Tales',
    seasonTag: 'halloween',
    extract: 'The Legend of Sleepy Hollow by Washington Irving tells the story of schoolmaster Ichabod Crane and his midnight encounter with the Headless Horseman, a ghostly Hessian trooper said to ride through the autumn woods in search of his missing head.',
    url: 'https://en.wikipedia.org/wiki/The_Legend_of_Sleepy_Hollow',
    titleWords: ['sleepy', 'hollow', 'headless', 'horseman'],
    keywords: ['horse', 'rider', 'bridge', 'woods', 'forest', 'night', 'pumpkin', 'ghost', 'tale', 'legend', 'autumn', 'valley', 'church', 'moon', 'shadow', 'lantern', 'chase', 'fear', 'folklore', 'story'],
  },
  // Christmas & Winter Curated Articles
  {
    title: 'Evergreen Christmas Tree Tradition',
    category: 'Christmas & Winter',
    seasonTag: 'christmas',
    extract: 'A Christmas tree is a decorated tree, usually an evergreen conifer such as a spruce, pine, or fir, associated with the celebration of Christmas. Originating in Renaissance Germany, trees are illuminated with fairy lights, glass baubles, tinsel, and a shining star or angel at the crown.',
    url: 'https://en.wikipedia.org/wiki/Christmas_tree',
    titleWords: ['evergreen', 'christmas', 'tree', 'tradition'],
    keywords: ['pine', 'spruce', 'fir', 'branch', 'needle', 'star', 'angel', 'light', 'tinsel', 'gift', 'snow', 'winter', 'carol', 'wreath', 'holly', 'candle', 'green', 'gold', 'red', 'feast'],
  },
  {
    title: 'Arctic Reindeer Winter Sleigh',
    category: 'Winter & Holiday Lore',
    seasonTag: 'christmas',
    extract: 'In festive folklore, Santa Claus rides a magical flying sleigh pulled by reindeer across the Christmas Eve sky to deliver gifts. Real Arctic reindeer are remarkably adapted to polar winters with hollow insulating fur, wide hooves for snow, and ultraviolet vision.',
    url: 'https://en.wikipedia.org/wiki/Santa_Claus%27s_reindeer',
    titleWords: ['arctic', 'reindeer', 'winter', 'sleigh'],
    keywords: ['snow', 'ice', 'north', 'pole', 'bell', 'roof', 'chimney', 'gift', 'toy', 'sack', 'antler', 'herd', 'tundra', 'frost', 'cold', 'night', 'star', 'flight', 'magic', 'carol'],
  },
  // Easter & Spring Curated Articles
  {
    title: 'Decorated Painted Easter Eggs',
    category: 'Easter & Springtime',
    seasonTag: 'easter',
    extract: 'Easter eggs are decorated eggs given to celebrate Easter and the arrival of springtime. Across cultures, traditions range from intricately wax-resisted Ukrainian pysanky and Imperial Faberge jeweled eggs to chocolate eggs hidden in garden hunts by the Easter Bunny.',
    url: 'https://en.wikipedia.org/wiki/Easter_egg',
    titleWords: ['decorated', 'painted', 'easter', 'eggs'],
    keywords: ['spring', 'basket', 'rabbit', 'bunny', 'hunt', 'garden', 'flower', 'lily', 'tulip', 'candy', 'shell', 'paint', 'dye', 'color', 'gold', 'ribbon', 'chick', 'nest', 'grass', 'feast'],
  },
  // General Encyclopedic Articles
  {
    title: 'Solar Eclipse Phenomenon',
    category: 'Astronomy & Space',
    seasonTag: 'general',
    extract: 'A solar eclipse occurs when the Moon passes between Earth and the Sun, obscuring the view of the Sun from a small part of the Earth, either totally or partially. During totality, the solar corona shimmers in the darkened sky while diamond ring effects appear along the lunar limb.',
    url: 'https://en.wikipedia.org/wiki/Solar_eclipse',
    titleWords: ['solar', 'eclipse', 'phenomenon'],
    keywords: ['moon', 'earth', 'sun', 'shadow', 'corona', 'orbit', 'lunar', 'light', 'totality', 'planet', 'sky', 'star', 'dark', 'ring', 'phase', 'align', 'space', 'view', 'time', 'path'],
  },
  {
    title: 'Great Barrier Coral Reef',
    category: 'Marine Ecology',
    seasonTag: 'general',
    extract: 'The Great Barrier Reef is the world largest coral reef system composed of over two thousand individual reefs and nine hundred islands stretching across the Coral Sea off the coast of Queensland, Australia. Built by billions of tiny organisms known as coral polyps, it supports extraordinary marine biodiversity.',
    url: 'https://en.wikipedia.org/wiki/Great_Barrier_Reef',
    titleWords: ['great', 'barrier', 'coral', 'reef'],
    keywords: ['ocean', 'sea', 'island', 'coast', 'water', 'marine', 'fish', 'shark', 'whale', 'turtle', 'sand', 'wave', 'tide', 'shell', 'life', 'dive', 'deep', 'blue', 'warm', 'tropics'],
  },
  {
    title: 'Ancient Library of Alexandria',
    category: 'Ancient History',
    seasonTag: 'general',
    extract: 'The Great Library of Alexandria in Egypt was one of the largest and most significant libraries of the ancient world. Functioning as a major center of Hellenistic scholarship under the Ptolemaic dynasty, it housed hundreds of thousands of papyrus scrolls covering mathematics, astronomy, literature, and medicine.',
    url: 'https://en.wikipedia.org/wiki/Library_of_Alexandria',
    titleWords: ['ancient', 'library', 'alexandria'],
    keywords: ['book', 'scroll', 'egypt', 'history', 'scholar', 'read', 'write', 'text', 'king', 'port', 'fire', 'stone', 'hall', 'study', 'wise', 'math', 'star', 'poet', 'greek', 'harbor'],
  },
  {
    title: 'Northern Aurora Borealis Lights',
    category: 'Atmospheric Physics',
    seasonTag: 'general',
    extract: 'An aurora, often called the northern lights or aurora borealis, is a natural light display in Earth sky predominantly seen in high-latitude regions around the Arctic and Antarctic. Auroras display dynamic curtains, rays, spirals, and flickers caused by solar wind disturbances in the magnetosphere.',
    url: 'https://en.wikipedia.org/wiki/Aurora',
    titleWords: ['northern', 'aurora', 'lights'],
    keywords: ['sky', 'night', 'glow', 'green', 'solar', 'wind', 'pole', 'arctic', 'ice', 'snow', 'cold', 'star', 'field', 'storm', 'ray', 'band', 'wave', 'atom', 'gas', 'ion'],
  },
  {
    title: 'Monarch Butterfly Migration',
    category: 'Entomology & Nature',
    seasonTag: 'autumn',
    extract: 'Monarch butterfly migration is the phenomenon in which millions of monarch butterflies travel thousands of miles across North America from southern Canada to overwintering mountain forests in central Mexico, navigating by a sun compass and circadian clock.',
    url: 'https://en.wikipedia.org/wiki/Monarch_butterfly_migration',
    titleWords: ['monarch', 'butterfly', 'migration'],
    keywords: ['wing', 'flight', 'insect', 'flower', 'plant', 'leaf', 'tree', 'forest', 'south', 'north', 'wind', 'sun', 'warm', 'cold', 'orange', 'black', 'gold', 'nest', 'egg', 'path'],
  },
  {
    title: 'Voyager Interstellar Space Probe',
    category: 'Space Exploration',
    seasonTag: 'general',
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

// Compute Easter Sunday (Meeus/Jones/Butcher algorithm) so Easter-season detection works for any year
function getEasterDate(year: number): { month: number; day: number } {
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
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

// Return a rich, diverse list of Wikipedia article slugs tailored to the current calendar season/holiday
function getDateSeasonalWikiSlugs(now = new Date()): {
  label: string;
  seasonTag: SeasonalWikiArticleSeed['seasonTag'];
  slugs: string[];
} {
  const month = now.getMonth() + 1; // 1..12
  const day = now.getDate();
  const year = now.getFullYear();

  // Check proximity to Easter (within 14 days before to 5 days after Easter Sunday)
  const easter = getEasterDate(year);
  const easterMs = new Date(year, easter.month - 1, easter.day).getTime();
  const nowMs = new Date(year, month - 1, day).getTime();
  const daysFromEaster = Math.round((nowMs - easterMs) / (1000 * 60 * 60 * 24));

  if (daysFromEaster >= -14 && daysFromEaster <= 5) {
    return {
      label: 'Easter & Springtime',
      seasonTag: 'easter',
      slugs: [
        'Easter_egg',
        'Easter_Bunny',
        'Hot_cross_bun',
        'Fabergé_egg',
        'Paschal_candle',
        'Egg_rolling',
        'Spring_equinox',
        'Tulip_mania',
        'Cherry_blossom',
        'European_hare',
        'Daffodil',
        'Chocolate',
        'Vernal_pool',
        'Butterfly_gardening',
      ],
    };
  }

  // Halloween & Spooky Season (Oct 15 – Nov 2)
  if ((month === 10 && day >= 15) || (month === 11 && day <= 2)) {
    return {
      label: 'Halloween & Autumn Folklore',
      seasonTag: 'halloween',
      slugs: [
        'Jack-o%27-lantern',
        'Trick-or-treating',
        'Samhain',
        'Haunted_house',
        'Day_of_the_Dead',
        'Headless_Horseman',
        'Salem_witch_trials',
        'Gothic_fiction',
        'Vampire_folklore',
        'Werewolf',
        'Frankenstein',
        'Bram_Stoker',
        'Black_cat',
        'Ghost_ship',
        'Will-o%27-the-wisp',
        'Gargoyle',
        'Common_raven',
        'Barn_owl',
        'Autumn_leaf_color',
        'Apple_bobbing',
      ],
    };
  }

  // Bonfire Night / Mid-November / Thanksgiving (Nov 3 – Nov 30)
  if (month === 11) {
    return {
      label: 'Autumn & Harvest Season',
      seasonTag: 'autumn',
      slugs: [
        'Gunpowder_Plot',
        'Guy_Fawkes_Night',
        'Fireworks',
        'Thanksgiving',
        'Mayflower',
        'Cornucopia',
        'Wild_turkey',
        'Pumpkin_pie',
        'Cranberry',
        'Harvest_festival',
        'Autumn_leaf_color',
        'Bird_migration',
      ],
    };
  }

  // Christmas, Winter Solstice & New Year (Dec 1 – Jan 5)
  if (month === 12 || (month === 1 && day <= 5)) {
    return {
      label: 'Christmas & Winter Season',
      seasonTag: 'christmas',
      slugs: [
        'Christmas_tree',
        'Santa_Claus',
        'Reindeer',
        'Winter_solstice',
        'Snowflake',
        'The_Nutcracker',
        'Gingerbread_house',
        'Yule_log',
        'Mistletoe',
        'Christmas_carol',
        'Silent_Night',
        'Candy_cane',
        'Advent_calendar',
        'Christmas_market',
        'Sleigh',
        'Aurora',
        'New_Year%27s_Eve',
        'Auld_Lang_Syne',
      ],
    };
  }

  // Valentine's Day (Feb 1 – Feb 16)
  if (month === 2 && day <= 16) {
    return {
      label: "Valentine's & Romance",
      seasonTag: 'winter',
      slugs: [
        'Valentine%27s_Day',
        'Cupid',
        'Garden_rose',
        'Chocolate_truffle',
        'Love_letter',
        'Courtly_love',
        'Romeo_and_Juliet',
        'Mute_swan',
      ],
    };
  }

  // St. Patrick's Day & Early Spring (Mar 10 – Mar 25)
  if (month === 3 && day >= 10 && day <= 25) {
    return {
      label: "St. Patrick's & Spring Equinox",
      seasonTag: 'spring',
      slugs: [
        'Saint_Patrick%27s_Day',
        'Shamrock',
        'Leprechaun',
        'Celtic_mythology',
        'Spring_equinox',
        'Rainbow',
        'Cherry_blossom',
        'Giant%27s_Causeway',
      ],
    };
  }

  // General Seasonal Fallbacks by Month
  if (month >= 3 && month <= 5) {
    return {
      label: 'Spring & Nature',
      seasonTag: 'spring',
      slugs: [
        'Cherry_blossom',
        'Honey_bee',
        'Botanical_garden',
        'Rainforest',
        'Pollination',
        'Hummingbird',
        'Greenhouse',
        'Rainbow',
      ],
    };
  }
  if (month >= 6 && month <= 8) {
    return {
      label: 'Summer & Solstice',
      seasonTag: 'summer',
      slugs: [
        'Summer_solstice',
        'Stonehenge',
        'Coral_reef',
        'Bioluminescence',
        'Firefly',
        'Perseids',
        'Lighthouse',
        'Sandcastle',
      ],
    };
  }
  if (month >= 9 && month <= 10) {
    return {
      label: 'Autumn & Harvest',
      seasonTag: 'autumn',
      slugs: [
        'Autumn_leaf_color',
        'Harvest_festival',
        'Apple_orchard',
        'Monarch_butterfly_migration',
        'Equinox',
        'Deciduous_forest',
        'Jack-o%27-lantern',
        'Samhain',
      ],
    };
  }
  return {
    label: 'Winter & Polar Wonders',
    seasonTag: 'winter',
    slugs: [
      'Snowflake',
      'Aurora',
      'Glacier',
      'Polar_bear',
      'Emperor_penguin',
      'Iceberg',
      'Avalanche',
      'Winter_solstice',
    ],
  };
}

// Track recently played article titles and round counter so articles never repeat
const recentArticleTitles: string[] = [];
const MAX_RECENT_HISTORY = 40;
let roundSelectionCounter = 0;

function markArticleUsed(title: string) {
  const norm = title.trim().toLowerCase();
  if (!recentArticleTitles.includes(norm)) {
    recentArticleTitles.push(norm);
    if (recentArticleTitles.length > MAX_RECENT_HISTORY) {
      recentArticleTitles.shift();
    }
  }
}

function isArticleRecentlyUsed(title: string): boolean {
  return recentArticleTitles.includes(title.trim().toLowerCase());
}

function buildArticleSeedFromWikiSummary(
  data: any,
  defaultCategory: string
): WikiArticleSeed | null {
  const rawTitle = String(data?.title || '')
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/_/g, ' ')
    .trim();
  const extract = String(data?.extract || '').trim();
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
    category: data?.description
      ? `${defaultCategory} · ${String(data.description).slice(0, 36)}`
      : defaultCategory,
    extract,
    url:
      data?.content_urls?.desktop?.page ||
      `https://en.wikipedia.org/wiki/${encodeURIComponent(rawTitle)}`,
    titleWords: uniqueTitleWords,
    keywords: Array.from(new Set(extractTokens)).slice(0, 30),
  };
}

// Cache Wikipedia "On This Day" articles per MM-DD so we don't re-fetch on every round
let cachedOnThisDayKey = '';
let cachedOnThisDayArticles: WikiArticleSeed[] = [];

async function getOnThisDayCandidates(now = new Date()): Promise<WikiArticleSeed[]> {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
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
        headers: { 'User-Agent': 'WiKirecTangled/2.0 (WordTycoon Live Puzzle)' },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const events = [
        ...(Array.isArray(data?.holidays) ? data.holidays : []),
        ...(Array.isArray(data?.selected) ? data.selected : []),
      ];
      const candidates: WikiArticleSeed[] = [];
      const seen = new Set<string>();
      for (const ev of events) {
        const pages = Array.isArray(ev?.pages) ? ev.pages : [];
        for (const p of pages) {
          const built = buildArticleSeedFromWikiSummary(p, `On This Day (${mm}/${dd})`);
          if (
            built &&
            built.titleWords.length >= 2 &&
            !seen.has(built.title.toLowerCase())
          ) {
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
  } catch {}
  return [];
}

export async function fetchWikipediaRoundArticle(options?: {
  seedKey?: string;
  compactSingleWord?: boolean;
}): Promise<WikiArticleSeed> {
  const trie = getTrie();
  const freq = getFrequencyMap();

  if (options?.compactSingleWord) {
    const compactCandidates = [
      'pumpkin', 'lantern', 'phantom', 'vampire', 'harvest', 'reindeer', 'snowfall',
      'planet', 'galaxy', 'eclipse', 'volcano', 'glacier', 'compass', 'library',
      'crystal', 'orchard', 'monarch', 'thunder', 'harbor', 'canyon',
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
  if (options?.seedKey && options.seedKey.startsWith('daily-')) {
    const idx = Math.abs(hashCode(options.seedKey)) % CURATED_WIKI_ARTICLES.length;
    const base = CURATED_WIKI_ARTICLES[idx];
    registerArticleWordsInDictionary(base, trie, freq);
    return base;
  }

  roundSelectionCounter += 1;
  const now = new Date();
  const seasonalInfo = getDateSeasonalWikiSlugs(now);

  // Rotate intelligently so date/holiday articles are prioritized without being repetitive:
  // - Round 1, 2, 4, 5, 7... -> Seasonal / Holiday (e.g. Halloween, Christmas, Easter) or "On This Day" Wikipedia article
  // - Every 3rd round -> General / Random Wikipedia article for variety
  const preferDateRelated = roundSelectionCounter % 3 !== 0;

  if (preferDateRelated) {
    // 1. Try an unused Seasonal / Holiday Wikipedia article (e.g., Halloween, Christmas, Easter)
    const unusedSlugs = seasonalInfo.slugs.filter((slug) => {
      const decoded = decodeURIComponent(slug).replace(/_/g, ' ');
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
            headers: { 'User-Agent': 'WiKirecTangled/2.0 (WordTycoon Live Puzzle)' },
            signal: controller.signal,
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
      } catch {}
    }

    // 2. Try an unused Wikipedia "On This Day" holiday/event article for today's date
    const onThisDayPool = await getOnThisDayCandidates(now);
    const unusedOnThisDay = onThisDayPool.filter((a) => !isArticleRecentlyUsed(a.title));
    if (unusedOnThisDay.length > 0) {
      const pickedOtd =
        unusedOnThisDay[Math.floor(Math.random() * unusedOnThisDay.length)];
      markArticleUsed(pickedOtd.title);
      registerArticleWordsInDictionary(pickedOtd, trie, freq);
      return pickedOtd;
    }

    // 3. Fallback to an unused curated seasonal article matching the current season
    const matchingCuratedSeasonal = CURATED_WIKI_ARTICLES.filter(
      (a) =>
        a.seasonTag === seasonalInfo.seasonTag && !isArticleRecentlyUsed(a.title)
    );
    if (matchingCuratedSeasonal.length > 0) {
      const picked =
        matchingCuratedSeasonal[
          Math.floor(Math.random() * matchingCuratedSeasonal.length)
        ];
      markArticleUsed(picked.title);
      registerArticleWordsInDictionary(picked, trie, freq);
      return picked;
    }
  }

  // Try fetching a live random Wikipedia summary (with fast 2200ms timeout)
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
      const article = buildArticleSeedFromWikiSummary(
        data,
        'Wikipedia Featured Article'
      );
      if (
        article &&
        article.titleWords.length >= 2 &&
        !isArticleRecentlyUsed(article.title)
      ) {
        markArticleUsed(article.title);
        registerArticleWordsInDictionary(article, trie, freq);
        return article;
      }
    }
  } catch {
    // Fallback cleanly to curated encyclopedic articles
  }

  // Final non-repeating curated fallback (prioritizing current season first, then general)
  const seasonalUnused = CURATED_WIKI_ARTICLES.filter(
    (a) => a.seasonTag === seasonalInfo.seasonTag && !isArticleRecentlyUsed(a.title)
  );
  const generalUnused = CURATED_WIKI_ARTICLES.filter(
    (a) => !isArticleRecentlyUsed(a.title)
  );
  const pool =
    seasonalUnused.length > 0
      ? seasonalUnused
      : generalUnused.length > 0
      ? generalUnused
      : CURATED_WIKI_ARTICLES;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  markArticleUsed(picked.title);
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
