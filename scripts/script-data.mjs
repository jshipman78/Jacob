// Narration + art direction data for "The Man Who Lied His Way to Troy".
//
// Each sentence: { text } for display captions, with an optional { tts }
// override when the written form (years, Roman numerals, "BCE") would be
// misread by the TTS engine.
//
// pauseAfter values are seconds of silence inserted after that unit,
// following the [pause] / [pause for effect] cues embedded in the script.

const S = (text, tts = null) => ({ text, ...(tts ? { tts } : {}) });

export const PAUSE = {
  sentence: 0.35, // default gap between sentences
  paragraph: 0.7, // default gap between paragraphs
  effect: 1.1, // "[pause for effect]"
  beat: 0.9, // "[pause]"
  section: 1.4, // gap between sections
};

export const SECTIONS = [
  {
    id: 'hook',
    title: 'THE MAN WHO LIED HIS WAY TO TROY',
    paragraphs: [
      {
        image: 'hook-trench',
        sentences: [
          S(
            'In 1873, a man dug a massive trench straight through the middle of one of the most important archaeological sites on Earth, blew past nine separate layers of ancient history without properly recording most of them, smuggled a king’s ransom in gold out of the country in his wife’s shawl, and then lied about almost every part of the story.',
            'In eighteen seventy-three, a man dug a massive trench straight through the middle of one of the most important archaeological sites on Earth, blew past nine separate layers of ancient history without properly recording most of them, smuggled a king’s ransom in gold out of the country in his wife’s shawl, and then lied about almost every part of the story.'
          ),
        ],
        pauseAfter: 'effect',
      },
      {
        image: 'hook-credit',
        sentences: [
          S('And he’s still, to this day, credited as the man who proved Troy was real.'),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'hook-portrait',
        sentences: [
          S('His name was Heinrich Schliemann.'),
          S('He wasn’t an archaeologist.'),
          S('He wasn’t a historian.'),
          S(
            'He was a retired businessman with a childhood obsession, a small fortune, and — as it turns out — a serious problem with the truth.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'hook-question',
        sentences: [
          S('So how does a man with no formal training end up finding one of the most famous lost cities in history?'),
          S('And how much of what we think we know about that discovery is actually something he made up?'),
        ],
        pauseAfter: 'effect',
      },
      {
        image: 'hook-title',
        sentences: [
          S(
            'This is the true story of Heinrich Schliemann — and the myth he built around himself that’s almost as famous as the myth he was trying to prove.'
          ),
        ],
        pauseAfter: 'section',
      },
    ],
  },
  {
    id: 'obsession',
    title: 'THE OBSESSION',
    paragraphs: [
      {
        image: 'obsession-book',
        sentences: [
          S(
            'Schliemann always claimed his fascination with Troy started as a child, after his father gave him an illustrated book of ancient history.'
          ),
          S(
            'According to Schliemann’s own account, he looked at a picture of Troy in flames and declared, right then, that he would one day dig up the city and prove it was real.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'obsession-book',
        sentences: [
          S('It’s a great story.'),
          S('Ambitious kid, impossible dream, decades of determination.'),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'obsession-letters',
        sentences: [
          S(
            'There’s just one issue historians keep running into with Heinrich Schliemann: he told a lot of great stories about himself.'
          ),
          S('And a disturbing number of them fall apart under scrutiny.'),
          S(
            'Letters, diaries, and business records that have since been cross-checked against his own later writings show that he rewrote his personal history more than once — sometimes small exaggerations, sometimes outright fabrications, including claims about meeting world leaders and witnessing historical events that other records simply don’t support.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'obsession-letters',
        sentences: [
          S(
            'So even the origin story — the entire reason we’re told he became obsessed with Troy in the first place — may itself be part myth.'
          ),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'obsession-merchant',
        sentences: [
          S(
            'What we do know for certain is this: Schliemann built an enormous fortune through international trade in the mid-1800s, retired wealthy while still relatively young, and turned his full attention to a question that most serious scholars at the time considered closed.',
            'What we do know for certain is this: Schliemann built an enormous fortune through international trade in the mid eighteen hundreds, retired wealthy while still relatively young, and turned his full attention to a question that most serious scholars at the time considered closed.'
          ),
          S('Troy, they believed, was a beautiful piece of literature — not a real place.'),
          S(
            'Homer’s city was treated the same way we’d treat Middle-earth today: a setting, not a location.'
          ),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'obsession-homer',
        sentences: [
          S('Schliemann disagreed.'),
          S(
            'And he had the one thing most skeptics of the theory didn’t have: enough money to just go dig and find out for himself.'
          ),
        ],
        pauseAfter: 'section',
      },
    ],
  },
  {
    id: 'dig',
    title: 'THE DIG',
    paragraphs: [
      {
        image: 'dig-dardanelles',
        sentences: [
          S(
            'In 1868, Schliemann traveled to northwestern Turkey, to a region near the coast of the Dardanelles, guided partly by the work of an earlier scholar and diplomat named Frank Calvert — a name that matters a lot more to this story than most retellings give him credit for.',
            'In eighteen sixty-eight, Schliemann traveled to northwestern Turkey, to a region near the coast of the Dardanelles, guided partly by the work of an earlier scholar and diplomat named Frank Calvert — a name that matters a lot more to this story than most retellings give him credit for.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'dig-calvert',
        sentences: [
          S(
            'Calvert, a British-American who had actually lived in the region for years, had already identified a mound called Hisarlik as the most likely site of ancient Troy, and had even begun excavating part of it himself.'
          ),
          S('But Calvert didn’t have Schliemann’s money.'),
          S('Schliemann did.'),
          S(
            'And when the two men joined forces, it was Schliemann’s name, not Calvert’s, that history remembered.'
          ),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'dig-partnership',
        sentences: [
          S('That alone tells you something about how this story tends to get told.'),
          S(
            'Calvert had spent years building relationships with local authorities, studying the terrain, and forming the theory in the first place.'
          ),
          S(
            'Schliemann arrived, funded the excavation, and within a few short years, his name was the one printed in newspapers across Europe.'
          ),
          S(
            'Calvert’s contribution was, for a long time, reduced to a footnote — and only in recent decades have historians made a serious effort to restore him to his proper place in the story.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'dig-partnership',
        sentences: [
          S(
            'It’s worth sitting with that for a second, because it’s going to become a pattern with Schliemann: someone else does the careful, foundational work, and Schliemann ends up with the credit, the fame, and the version of the story that gets remembered.'
          ),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'dig-crews',
        sentences: [
          S(
            'Starting in 1871, Schliemann began digging at Hisarlik at a scale nobody had attempted before.',
            'Starting in eighteen seventy-one, Schliemann began digging at Hisarlik at a scale nobody had attempted before.'
          ),
          S('And this is where his lack of formal training becomes a serious problem.'),
          S(
            'Modern archaeology is slow, careful, and methodical — every layer of soil documented before it’s removed, because each layer represents a different era, and once you dig through it, that information is gone forever.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'dig-crews',
        sentences: [S('Schliemann did not work that way.')],
        pauseAfter: 'paragraph',
      },
      {
        image: 'dig-trench',
        sentences: [
          S(
            'He used massive digging crews and, in places, actual explosives to cut through the mound as fast as possible.'
          ),
          S(
            'He carved an enormous trench straight down through the site — a trench so aggressive that later archaeologists nicknamed it “Schliemann’s Great Trench” — slicing through multiple layers of the ancient city with almost no record of what he was destroying along the way.'
          ),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'dig-layers',
        sentences: [
          S('Hisarlik, as later excavation would reveal, isn’t one city.'),
          S(
            'It’s at least nine cities, stacked on top of each other across roughly four thousand years, labeled Troy I at the bottom up through Troy IX near the top.',
            'It’s at least nine cities, stacked on top of each other across roughly four thousand years, labeled Troy One at the bottom up through Troy Nine near the top.'
          ),
          S('Somewhere in that stack was almost certainly the city that inspired Homer’s Troy.'),
        ],
        pauseAfter: 'effect',
      },
      {
        image: 'dig-layers',
        sentences: [
          S('Schliemann didn’t carefully work down through those layers to find it.'),
          S(
            'He blasted through most of them looking for the biggest, most impressive find he could locate — and in 1873, he got one.',
            'He blasted through most of them looking for the biggest, most impressive find he could locate — and in eighteen seventy-three, he got one.'
          ),
        ],
        pauseAfter: 'section',
      },
    ],
  },
  {
    id: 'treasure',
    title: 'THE TREASURE AND THE LIE',
    paragraphs: [
      {
        image: 'treasure-gold',
        sentences: [
          S(
            'Deep in the layer we now call Troy II, Schliemann’s crew uncovered an extraordinary hoard: gold jewelry, diadems, cups, and thousands of smaller gold and silver objects, all clustered together as if someone had hidden them deliberately, in a hurry, a very long time ago.',
            'Deep in the layer we now call Troy Two, Schliemann’s crew uncovered an extraordinary hoard: gold jewelry, diadems, cups, and thousands of smaller gold and silver objects, all clustered together as if someone had hidden them deliberately, in a hurry, a very long time ago.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'treasure-shawl',
        sentences: [
          S(
            'Schliemann named it immediately, and dramatically: Priam’s Treasure, after the legendary king of Troy from the Iliad.'
          ),
          S(
            'In his telling, he had personally spotted a glint of gold in the trench wall, dismissed his workers for the day so he could excavate it alone with his wife Sophia, and together they carried the treasure out wrapped in her shawl to keep it hidden from Ottoman officials, who — under the terms of his excavation permit — were legally entitled to a share of anything found.'
          ),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'treasure-shawl',
        sentences: [S('It’s a fantastic scene.'), S('Secretive, romantic, daring.')],
        pauseAfter: 'beat',
      },
      {
        image: 'treasure-sophia',
        sentences: [
          S('It also appears to be at least partly fabricated.'),
          S(
            'Sophia Schliemann’s own family later confirmed she wasn’t even at the excavation site on the day the treasure was supposedly found — she was visiting relatives elsewhere in Greece.'
          ),
          S(
            'Schliemann seems to have written her into the story afterward, likely to make the discovery feel more personal, more cinematic, more worthy of the legend he was building around himself.'
          ),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'treasure-smuggle',
        sentences: [
          S('And he did smuggle the gold — that part holds up.'),
          S(
            'He got the treasure out of Ottoman territory without permission, in violation of his agreement, and the Ottoman government was furious enough that Schliemann was later fined and temporarily banned from further excavation in the region.'
          ),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'treasure-date',
        sentences: [
          S(
            'But here’s the detail that undermines the entire dramatic framing of “Priam’s Treasure”: the layer where Schliemann found it — Troy II — dates to somewhere around 2400 to 2600 BCE.',
            'But here’s the detail that undermines the entire dramatic framing of “Priam’s Treasure”: the layer where Schliemann found it — Troy Two — dates to somewhere around twenty-four hundred to twenty-six hundred B C E.'
          ),
          S(
            'The Trojan War, if it happened at all, is generally placed around 1200 BCE.',
            'The Trojan War, if it happened at all, is generally placed around twelve hundred B C E.'
          ),
          S('That’s a gap of well over a thousand years.'),
        ],
        pauseAfter: 'effect',
      },
      {
        image: 'treasure-date',
        sentences: [
          S(
            'The gold Schliemann was so certain belonged to the legendary King Priam was already ancient history by the time the Trojan War, in any historical sense, could have taken place.'
          ),
          S(
            'He’d found something real, something genuinely valuable and important — just not the thing he claimed to have found.'
          ),
        ],
        pauseAfter: 'section',
      },
    ],
  },
  {
    id: 'wrong-right',
    title: 'BEING WRONG AND STILL BEING RIGHT',
    paragraphs: [
      {
        image: 'right-ruins',
        sentences: [
          S(
            'This is where Schliemann’s story gets genuinely complicated, in a way that a lot of quick retellings skip over.'
          ),
          S('He was, in a very real sense, both wrong and right at the same time.'),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'right-destroyed',
        sentences: [
          S('He was wrong about which layer of Hisarlik matched Homer’s Troy.'),
          S('He was wrong about the treasure belonging to Priam.'),
          S(
            'He was wrong, by his own later admission, about several of the conclusions he rushed to publish.'
          ),
          S(
            'And in his haste to find something spectacular, he physically destroyed archaeological evidence in the upper layers of the site — including, we now believe, evidence from Troy VIIa, the layer most modern scholars consider the best candidate for a war-era Troy — evidence that we can never fully recover, because he’d already dug through it before anyone understood its importance.',
            'And in his haste to find something spectacular, he physically destroyed archaeological evidence in the upper layers of the site — including, we now believe, evidence from Troy Seven A, the layer most modern scholars consider the best candidate for a war-era Troy — evidence that we can never fully recover, because he’d already dug through it before anyone understood its importance.'
          ),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'right-ruins',
        sentences: [
          S(
            'And yet — he was right about the one thing every scholar of his era told him he was wrong about: that Troy was a real place, sitting at a real, identifiable location, and that a real, ancient, walled city existed there.'
          ),
          S(
            'Later, more careful excavations, led by Wilhelm Dörpfeld and then Carl Blegen in the following decades, went back through what Schliemann left behind, corrected his layer identifications, and confirmed that Hisarlik is, in fact, the site of ancient Troy.',
            'Later, more careful excavations, led by Wilhelm Dorpfeld and then Carl Blegen in the following decades, went back through what Schliemann left behind, corrected his layer identifications, and confirmed that Hisarlik is, in fact, the site of ancient Troy.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'right-ruins',
        sentences: [S('He got the address right and almost everything else about the story wrong.')],
        pauseAfter: 'paragraph',
      },
      {
        image: 'right-dorpfeld',
        sentences: [
          S('To his credit, Schliemann did eventually bring on more rigorous help.'),
          S(
            'Wilhelm Dörpfeld, a trained architect and archaeologist, joined his later excavations and pushed for far more careful, systematic methods than Schliemann had used on his own.',
            'Wilhelm Dorpfeld, a trained architect and archaeologist, joined his later excavations and pushed for far more careful, systematic methods than Schliemann had used on his own.'
          ),
          S(
            'It was Dörpfeld who first proposed that the war-era Troy was likely a different, higher layer than the one Schliemann had first celebrated — a correction Schliemann, to his credit, eventually accepted, even though it meant walking back some of his own earlier claims.',
            'It was Dorpfeld who first proposed that the war-era Troy was likely a different, higher layer than the one Schliemann had first celebrated — a correction Schliemann, to his credit, eventually accepted, even though it meant walking back some of his own earlier claims.'
          ),
          S(
            'Decades later, American archaeologist Carl Blegen led an even more thorough excavation in the 1930s, finally pinning down Troy VIIa as the layer most consistent with a violent, war-era destruction around 1180 BCE — the layer we talked about in the last video.',
            'Decades later, American archaeologist Carl Blegen led an even more thorough excavation in the nineteen thirties, finally pinning down Troy Seven A as the layer most consistent with a violent, war-era destruction around eleven eighty B C E — the layer we talked about in the last video.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'right-blegen',
        sentences: [
          S('So the real story of “finding Troy” isn’t really one man’s triumph.'),
          S(
            'It’s a relay race across three generations of excavators, each one correcting the mistakes of the last — and Schliemann just happens to be the one whose name ended up on the headline.'
          ),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'right-question',
        sentences: [
          S(
            'Which raises an uncomfortable question for how we tell history: do we remember Heinrich Schliemann as the brilliant amateur who succeeded where trained scholars had failed — or as a reckless treasure hunter who got lucky, destroyed irreplaceable evidence, and then lied about the details to make himself the hero of his own story?'
          ),
        ],
        pauseAfter: 'effect',
      },
      {
        image: 'right-question',
        sentences: [S('The honest answer, based on everything we actually know, is probably both.')],
        pauseAfter: 'section',
      },
    ],
  },
  {
    id: 'legacy',
    title: 'THE LEGACY',
    paragraphs: [
      {
        image: 'legacy-modern',
        sentences: [
          S(
            'Whatever you think of his methods, Schliemann’s excavation changed archaeology permanently — partly by proving that legendary “mythical” places could have real physical locations worth searching for, and partly as a cautionary example of exactly how not to excavate a historically important site.'
          ),
          S(
            'Modern archaeological techniques — careful stratigraphy, detailed layer-by-layer documentation, painstaking preservation of context — developed in large part as a direct reaction against the kind of destructive, glory-chasing methods Schliemann used at Hisarlik.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'legacy-modern',
        sentences: [
          S('In a strange way, his mistakes were almost as influential as his discovery.'),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'legacy-tangled',
        sentences: [
          S(
            'And that, honestly, might be the most fitting outcome possible for this particular story.'
          ),
          S(
            'Schliemann spent his life chasing a legend, and in the process, became one himself — a figure whose real accomplishments and self-invented myths are now so tangled together that separating them, more than 150 years later, still takes real work.',
            'Schliemann spent his life chasing a legend, and in the process, became one himself — a figure whose real accomplishments and self-invented myths are now so tangled together that separating them, more than a hundred and fifty years later, still takes real work.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'legacy-tangled',
        sentences: [S('Sound familiar?')],
        pauseAfter: 'section',
      },
    ],
  },
  {
    id: 'outro',
    title: 'EVERY LEGEND HAS A LAYER OF TRUTH',
    paragraphs: [
      {
        image: 'outro-theme',
        sentences: [
          S(
            'If there’s a theme connecting this channel, it’s this: almost every great historical story has a real event buried somewhere underneath layers of exaggeration, myth, and people rewriting the record to make themselves look better.'
          ),
        ],
        pauseAfter: 'beat',
      },
      {
        image: 'outro-theme',
        sentences: [
          S('Heinrich Schliemann didn’t just find a lost city.'),
          S(
            'He became a perfect case study in how history gets shaped by the people who tell it — for better and for worse.'
          ),
        ],
        pauseAfter: 'paragraph',
      },
      {
        image: 'outro-troy',
        sentences: [
          S(
            'If you enjoyed this one, my previous video covers the full story of the Trojan War itself, and exactly how much of it holds up against the archaeology Schliemann helped uncover — so if you haven’t seen that one yet, that’s a great place to go next.'
          ),
        ],
        pauseAfter: 'effect',
      },
      {
        image: 'outro-troy',
        sentences: [S('Thanks for watching.'), S('I’ll see you in the next one.')],
        pauseAfter: 'paragraph',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Art direction. One shared style so the whole video reads as a single piece:
// moody 19th-century-documentary oil painting, warm gold against deep shadow,
// matching the script's low/intense tone cues.
// ---------------------------------------------------------------------------

export const STYLE_SUFFIX =
  'Dramatic cinematic oil painting, 19th century historical illustration style, chiaroscuro lighting, warm gold and amber tones against deep shadow, painterly brushwork, atmospheric haze, epic documentary mood, highly detailed';

export const IMAGES = [
  {
    id: 'hook-trench',
    prompt:
      'A colossal excavation trench cut straight through an ancient earthen mound at dusk, dozens of tiny workers with pickaxes and baskets dwarfed by the gash in the earth, exposed strata layers visible in the trench walls, ominous storm light',
  },
  {
    id: 'hook-credit',
    prompt:
      'Golden jewelry and diadems half-wrapped in a dark woolen shawl, lit by a single candle flame in a dark tent, secretive atmosphere, glinting treasure in shadow',
  },
  {
    id: 'hook-portrait',
    prompt:
      'Formal portrait of a stern 19th century German businessman in his fifties, receding hair and neat mustache, black frock coat and high collar, piercing calculating eyes, dark studio background, style of a Victorian era oil portrait',
  },
  {
    id: 'hook-question',
    prompt:
      'A man in Victorian travel clothes standing alone on a vast windswept mound in Anatolia, holding an open copy of the Iliad, distant plains and the Dardanelles strait behind him, golden storm light breaking through clouds',
  },
  {
    id: 'hook-title',
    prompt:
      'The ancient city of Troy engulfed in flames at night, massive stone walls and towers burning, embers rising into a black sky, epic wide shot, mythic and apocalyptic',
  },
  {
    id: 'obsession-book',
    prompt:
      'A young boy in 1830s rural German clothing reading a large illustrated book by candlelight in a dark cottage, the open page showing an engraving of a burning ancient city, wonder on his face, warm candle glow against darkness',
  },
  {
    id: 'obsession-letters',
    prompt:
      'A cluttered 19th century writing desk covered in handwritten letters, leather diaries and business ledgers, a magnifying glass resting on contradicting documents, ink pot and quill, moody lamplight, sense of secrets and revision',
  },
  {
    id: 'obsession-merchant',
    prompt:
      'A bustling 1850s international trading port with tall sailing ships and stacked cargo crates, a wealthy merchant in a top hat overseeing the commerce from the dock, golden afternoon haze over the harbor',
  },
  {
    id: 'obsession-homer',
    prompt:
      'A marble bust of Homer beside ancient Greek scrolls on a scholar’s shelf, dust motes in a shaft of golden library light, dark wood and old leather books, classical and contemplative',
  },
  {
    id: 'dig-dardanelles',
    prompt:
      'Wide landscape of the plains of the Dardanelles in northwestern Turkey, a low grassy mound rising above windswept fields, the strait glittering in the distance, dramatic clouds, 19th century landscape painting',
  },
  {
    id: 'dig-calvert',
    prompt:
      'A thoughtful British gentleman scholar in 1860s field dress kneeling on a grassy mound, examining pottery shards and consulting a hand-drawn survey map, careful and methodical, soft morning light',
  },
  {
    id: 'dig-partnership',
    prompt:
      'Two 19th century gentlemen studying excavation maps spread over a wooden table inside a canvas field tent, one confident and wealthy, one reserved and scholarly, lantern light, subtle tension between them',
  },
  {
    id: 'dig-crews',
    prompt:
      'An enormous chaotic 1870s excavation with over a hundred laborers swinging pickaxes and hauling baskets of earth down a huge mound, dust clouds rising, wheelbarrows and wooden ramps, frantic destructive energy',
  },
  {
    id: 'dig-trench',
    prompt:
      'A vast deep trench sliced vertically through an ancient tell mound, sheer earthen walls revealing many distinct stratified layers of ruined stone walls, tiny figures at the bottom, awe and destruction, dramatic raking light',
  },
  {
    id: 'dig-layers',
    prompt:
      'Cross-section view of nine ancient cities stacked vertically on top of each other inside a hill, each layer a different era of stone walls and ruins from primitive to grand, geological strata between them, epic archaeological diagram as a dramatic painting',
  },
  {
    id: 'treasure-gold',
    prompt:
      'An extraordinary hoard of ancient gold emerging from dark excavated earth: golden diadems, cups, bracelets and thousands of small ornaments clustered together, lit like a revelation against black soil, glowing treasure',
  },
  {
    id: 'treasure-shawl',
    prompt:
      'A man and woman in Victorian clothing hurrying through an excavation trench at dusk, carrying a bulging shawl wrapped around hidden treasure, looking over their shoulders, furtive lantern light, cinematic suspense',
  },
  {
    id: 'treasure-sophia',
    prompt:
      'Portrait of a young Greek woman in 1870s dress wearing an elaborate ancient golden diadem with cascading gold pendants across her forehead, gold necklaces, calm enigmatic expression, dark background, style of an early studio photograph rendered as an oil painting',
  },
  {
    id: 'treasure-smuggle',
    prompt:
      'Night scene of crates being loaded onto a small boat by lantern light on the Ottoman coast, furtive figures, moonlit water, smuggling atmosphere, deep blues and warm lantern gold',
  },
  {
    id: 'treasure-date',
    prompt:
      'Ancient golden diadem resting on stone beside a crumbling early Bronze Age citadel far older than the Trojan War, deep time made visible, half in shadow half in golden light, contemplative and revelatory',
  },
  {
    id: 'right-ruins',
    prompt:
      'The excavated stone walls and gate of the ancient citadel of Troy at golden hour, weathered limestone masonry casting long shadows, the plains of the Dardanelles beyond, quiet monumental grandeur',
  },
  {
    id: 'right-destroyed',
    prompt:
      'Broken pottery shards and crushed ancient wall fragments discarded in spoil heaps beside a brutal excavation trench, lost evidence scattered in rubble, elegiac mood, cold overcast light with hints of gold',
  },
  {
    id: 'right-dorpfeld',
    prompt:
      'A meticulous German architect-archaeologist in 1880s field clothes carefully measuring and drawing a stone wall section in a notebook, measuring tools and neat documentation, patient methodical order, soft daylight',
  },
  {
    id: 'right-blegen',
    prompt:
      'A 1930s American archaeological excavation with a precise grid of string lines and stakes, archaeologists in khaki kneeling with trowels and brushes, careful sifting screens, organized scientific archaeology, warm period light',
  },
  {
    id: 'right-question',
    prompt:
      'A double-faced monument: half a noble bronze statue of a visionary explorer, half a crumbling shadowed figure clutching stolen gold, split by dramatic light and dark, allegory of a contested legacy',
  },
  {
    id: 'legacy-modern',
    prompt:
      'Modern archaeologists working carefully in an excavation square with brushes, trowels and labeled markers, precise stratigraphy exposed in clean sections, tablet documentation, respectful careful work at the ancient site of Troy',
  },
  {
    id: 'legacy-tangled',
    prompt:
      'A colossal figure of a 19th century man woven from golden threads and dark smoke standing over the ruins of Troy at twilight, myth and reality intertwined and inseparable, stars emerging, epic and haunting',
  },
  {
    id: 'outro-theme',
    prompt:
      'Layers of parchment manuscripts, maps and legends peeling back to reveal a small solid ancient stone wall underneath, truth buried under layers of myth made visible, warm lamplight, allegorical still life',
  },
  {
    id: 'outro-troy',
    prompt:
      'The walls of ancient Troy at sunset seen from the plain, wind moving through golden grass, the fortress glowing amber against a violet sky, peaceful epic closing shot, sense of an ending',
  },
];
