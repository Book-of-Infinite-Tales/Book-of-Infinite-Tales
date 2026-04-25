// ---------------------------------------------------------------------------
// Book of Infinite Tales — schema v1
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 'book-of-infinite-tales/v1' as const;
export const INDEX_SCHEMA_VERSION = 'book-of-infinite-tales/index/v1' as const;

// --- Skills & Renown -------------------------------------------------------

/** The 12 canonical skill names from Tales of the Arthurian Knights. */
export type SkillName =
  // Martial
  | 'Warfare'
  | 'Sword & Shield'
  | 'Mounted'
  // Spiritual
  | 'Piety'
  | 'Wisdom'
  | 'Magic'
  // Courtly
  | 'Diplomacy'
  | 'Cunning'
  | 'Honor'
  // Wilderness
  | 'Nature Lore'
  | 'Endure Hardship'
  | 'Hunting';

/** Skill category — use to allow any skill within the category. */
export type SkillCategory = 'Martial' | 'Spiritual' | 'Courtly' | 'Wilderness';

/** A skill declared in the components file, with its category. */
export type Skill = {
  id: string;
  name: string;
  category: SkillCategory;
};

/** The three tracks of renown, plus "Any" for player's choice of track. */
export type RenownType = 'Divinity' | 'Romance' | 'Villainy' | 'Any';

/** Anything that can be offered as a way to resolve a check. */
export type CheckOption = SkillName | SkillCategory | RenownType;

// --- Resolution target -----------------------------------------------------

/**
 * How hard a check is.
 *   - A plain number  → fixed difficulty (roll 1d6 + Skill Rank ≥ value)
 *   - Object form     → variable: difficulty = base + the space's Location #
 *
 * For renown checks there is no die roll — the player just needs that many
 * accumulated Ranks in the renown type.
 */
export type ResolutionTarget =
  | number
  | { base: number; addLocationNumber: true };

// --- Rewards ---------------------------------------------------------------

/** A gain or loss of renown ranks. Negative delta = lose ranks. */
export type RenownDelta = {
  type: RenownType;
  /** Positive = gain ranks; negative = lose ranks. */
  delta: number;
};

/**
 * A skill reward.
 * Specify `name` for a specific skill, or `category` for "any [Category] skill
 * of your choice". `count` defaults to 1.
 */
export type SkillReward =
  | { name: SkillName; count?: number }
  | { category: SkillCategory; count?: number };

export type StatusEffect = {
  action: 'gain' | 'lose';
  /** The status card name, e.g. "Accompanied", "Accursed", "Mad". */
  name: string;
};

/** A passage reachable when the knight holds a particular status. */
export type StatusEncounter = {
  label: string;
  passage: string;
};

/** A status card declared in the components file. */
export type StatusCard = {
  id: string;
  name: string;
  /** Passages associated with this status (e.g. escape attempts, evasion). */
  encounters?: StatusEncounter[];
};

/**
 * A story token declared in the components file.
 * Tokens are numbered 1–N. `note` captures any printed effect on the token
 * (e.g. "Move 1", "Passage 2134", "Age 3 → Token 6") for reference.
 */
export type StoryToken = {
  number: number;
  note?: string;
};

/**
 * The reward block at the end of a resolution outcome.
 * All fields are optional — include only what applies.
 */
export type Reward = {
  /**
   * Destiny points earned. Use `"location_number"` when the reward equals
   * the Location # of the knight's current space.
   */
  destiny?: number | 'location_number';
  renown?: RenownDelta[];
  skills?: SkillReward[];
  /**
   * Treasures gained.
   *   - A number: draw that many random cards.
   *   - A string: search for the named card specifically.
   */
  treasures?: number | string;
  statuses?: StatusEffect[];
  /** Story token gained (provide the token number). */
  storyToken?: number;
  /** Bonus map movement after the encounter. `"free"` = unrestricted. */
  movement?: number | 'free';
};

// --- Response options (on response passages) -------------------------------

/**
 * A narrative choice on a response passage. Each option leads to a separate
 * resolution passage (or sometimes directly to a result passage for simple
 * narrative branches).
 */
export type ResponseOption = {
  /** Reader-facing label, e.g. "You may seek to allay the queen's grief." */
  label: string;
  /** Mark true for any option involving romantic love (asterisk convention). */
  romantic?: boolean;
  /** Entry id to turn to when this option is chosen. */
  goto: string;
};

// --- Resolution options (on resolution passages) ---------------------------

/**
 * The outcome of a resolution — one for success, one for failure.
 * Contains the narrative prose to read and any rewards earned.
 */
export type ResolutionOutcome = {
  /** Prose read aloud to describe the outcome. Use `\n\n` for paragraphs. */
  body: string;
  /** Rewards applied (structured — rendered as a bracket `[…]`). */
  rewards?: Reward;
  /**
   * Optional continuation — jump to another entry after reading this outcome.
   * Rare; most outcomes are terminal.
   */
  goto?: string;
};

/**
 * A single way to resolve a resolution passage — one skill or renown option
 * with its target and both success/failure outcomes inline.
 *
 * In the reader, a resolution passage presents all its options at once.
 * The player commits to one, rolls (if using a skill), and reads the matching
 * outcome.
 */
export type ResolutionOption = {
  /**
   * Optional narrative description of what this skill choice represents,
   * e.g. "listen to the whole story" or "console him with your faith".
   * Shown alongside the skill name(s).
   */
  label?: string;
  /**
   * One or more skills / renown types the player may pick from for this
   * resolution. Most options list one; some offer alternatives.
   */
  using: CheckOption[];
  /** The difficulty to meet or exceed. */
  target: ResolutionTarget;
  /** Mark true if this resolution is romantic content. */
  romantic?: boolean;
  success: ResolutionOutcome;
  failure: ResolutionOutcome;
};

// --- Entry -----------------------------------------------------------------

/**
 * Whether the knight's retinue is present during this scene.
 *
 *   - `"beside"` — retainers are right there with the knight
 *   - `"nearby"` — retainers are close by but not at the knight's side
 *   - `"absent"` — knight is scouting ahead; retainers are elsewhere
 *
 * Omit if not relevant to the scene.
 */
export type RetinuePresence = 'beside' | 'nearby' | 'absent';

/**
 * A passage in the Book of Tales.
 *
 * Passages are typed by what structural elements they contain:
 *
 *   - **Response passage**: has `responses` — narrative choices leading to
 *     other passages. Usually the first passage of a standard encounter.
 *
 *   - **Resolution passage**: has `resolutions` — skill/renown options for
 *     resolving the encounter. Each option has inline success and failure
 *     outcomes with rewards.
 *
 *   - **Result passage**: has `rewards` (and/or plain `body` ending). A
 *     terminal narrative destination, e.g. a simple narrative outcome that
 *     didn't need a skill check.
 *
 *   - **Unusual encounter**: may mix `responses` and `resolutions`, or
 *     provide a `goto` continuation — used for non-standard encounter flows.
 */
export type Entry = {
  /** Unique identifier. Numeric strings ("1", "1234") sort naturally. */
  id: string;
  /** Prose read aloud. Use `\n\n` to separate paragraphs. */
  body: string;
  /** True if this entry is romantic content (asterisk convention). */
  romantic?: boolean;
  /** Retinue presence — shown as a scene-setting note. */
  retinue?: RetinuePresence;

  /** Response passage options (narrative choices). */
  responses?: ResponseOption[];
  /** Resolution passage options (skill checks with inline outcomes). */
  resolutions?: ResolutionOption[];
  /** Reward block for terminal result passages. */
  rewards?: Reward;
  /** Optional continuation after this passage — jump to another entry. */
  goto?: string;
};

// --- Book components -------------------------------------------------------
//
// Optional `components` field on the manifest points to a separate JSON file
// describing the game's physical components — Ages, Characters, Features,
// Locations, Milieus, Terrains, Quests — so the reader can help compose the
// right passage number for a given encounter. Multiple books can share the
// same components file. A book can omit this field entirely, in which case
// the reader just provides manual passage lookup.

/** An Age of the game. Has a start passage read when the age begins. */
export type Age = {
  /** Short id, e.g. "1", "2", "3". */
  id: string;
  /** Full name, e.g. "Golden Age of Camelot". */
  name: string;
  /** Entry id read aloud when this age starts. Usually 1000, 2000, 3000, etc. */
  startPassage?: string;
  /**
   * Base number added to a Milieu card's terrain offset to form the passage id.
   * e.g. milieuBase 2200 + Strange Beast mountain offset 29 = passage 2229.
   * Required if this book uses Milieu encounters.
   */
  milieuBase?: number;
};

/** A terrain type, used for milieu encounters. */
export type Terrain = {
  id: string;
  name: string;
};

/**
 * A Feature card — combines with a Character to form a passage number.
 * Passage = character.base + feature.offset.
 */
export type Feature = {
  id: string;
  name: string;
  /** 2-digit offset added to a character's base. */
  offset: number;
};

/**
 * A Character card. Its base is a multiple of 100; combined with a Feature
 * offset to form a 4-digit passage number.
 */
export type Character = {
  id: string;
  name: string;
  /** Base passage number. Typically a multiple of 100, e.g. 1200, 1900. */
  base: number;
};

/**
 * A Location card. Has one regular passage (read when the card is drawn)
 * and, usually, a per-age "visit" passage for the Place of Power encounter.
 */
export type Location = {
  id: string;
  name: string;
  /** Passage read when the Location card is first drawn. */
  passage: string;
  /**
   * Passage id for visiting this location as a special encounter, by age id.
   * `visitPassages["2"]` = passage for visiting during Age 2.
   */
  visitPassages?: Record<string, string>;
};

/**
 * A Milieu card. The passage for a given encounter is computed as:
 *   age.milieuBase + milieu.terrainOffsets[terrainId]
 *
 * e.g. Age 2 milieuBase 2200 + Strange Beast mountain offset 29 = passage 2229.
 * Terrain ids with no offset declared are unavailable for this milieu.
 */
export type Milieu = {
  id: string;
  name: string;
  /**
   * Per-terrain 2-digit offsets added to the age's milieuBase.
   * terrainOffsets[terrainId] = offset number.
   * e.g. { "mountain": 29, "forest": 26 }
   */
  terrainOffsets: Record<string, number>;
};

/** A Quest, with a passage read upon reaching/resolving the quest. */
export type Quest = {
  id: string;
  name: string;
  /** Entry id read when the quest is resolved (or encountered). */
  passage: string;
};

export type BookComponents = {
  ages: Age[];
  terrains?: Terrain[];
  features?: Feature[];
  characters?: Character[];
  locations?: Location[];
  milieus?: Milieu[];
  quests?: Quest[];
  /** Fixed set of skills for this game. When present, skill names in resolutions and rewards are validated against this list. */
  skills?: Skill[];
  /** Fixed set of story tokens for this game. When present, token numbers in rewards are validated against this list. */
  storyTokens?: StoryToken[];
  /** Fixed set of status cards for this game. When present, status names in rewards are validated against this list. */
  statuses?: StatusCard[];
  /** Entry id read at the very end of the game — shown alongside the age buttons. */
  epiloguePassage?: string;
};

// --- Book manifest ---------------------------------------------------------

export type BookManifest = {
  schema: typeof SCHEMA_VERSION;
  title: string;
  author?: string;
  version?: string;
  description?: string;
  /**
   * The book's entries — either inline (array or id→Entry map) or the
   * filename of a separate JSON file (relative to book.json).
   */
  entries: string | Entry[] | Record<string, Entry>;
  /**
   * Filename of the board game components file (relative to book.json).
   * Omit for books with no encounter-picker structure.
   * Multiple books can share the same components file.
   */
  components?: string;
};

// --- Loaded book -----------------------------------------------------------

export type Book = {
  manifest: BookManifest;
  entries: Record<string, Entry>;
  components?: BookComponents;
  source: BookSource;
};

export type BookSource = {
  kind: 'github';
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
};

// --- Multi-book index -------------------------------------------------------

/** One entry in a books.json index — points to a subdirectory with its own book.json. */
export type BookIndexEntry = {
  path: string;
  title: string;
  description?: string;
};

/**
 * A books.json index file at the root of a multi-book repo.
 * Each entry's path is relative to the repo root and must contain a book.json.
 */
export type BookIndex = {
  schema: typeof INDEX_SCHEMA_VERSION;
  title: string;
  author?: string;
  description?: string;
  books: BookIndexEntry[];
};
