import type { LevelSpec } from '../src/core/generate.ts';

/**
 * The levels, in trail order. `npm run levels:generate` lays them out into src/levels/.
 *
 * Words are things you can see in the painting: finding them is looking at it. Their letters must
 * fill the board exactly (rows * cols), and the board's shape follows the painting's, so the reveal
 * crops as little as possible. Stories are our own short texts (never copied from Wikipedia or a
 * museum): what is in the picture, who made it, and one thing worth remembering.
 */
export const SPECS: LevelSpec[] = [
  {
    id: 'starry-night',
    room: 'icons',
    rows: 5,
    cols: 7,
    words: ['CYPRESS', 'MOON', 'STARS', 'VILLAGE', 'STEEPLE', 'HILLS'],
    art: {
      slug: 'the-starry-night-gogh',
      title: 'The Starry Night',
      artist: 'Vincent van Gogh',
      year: '1889',
      holder: 'Museum of Modern Art, New York',
      credit: 'Public domain · image via Wikimedia Commons (Google Art Project)',
      story:
        'In June 1889 Vincent van Gogh painted the view from his window at the asylum in Saint-Rémy, just before dawn. But this sky is not quite what he saw: the stars swell into whirlpools of light, the moon blazes, and a dark cypress flickers upward like a flame. Below, a sleepy village keeps its lamps lit, its church steeple pointing at the storm of stars. Van Gogh thought the painting was a failure. Today it is one of the most loved pictures in the world.',
    },
  },
  {
    id: 'great-wave',
    room: 'icons',
    rows: 5,
    cols: 7,
    words: ['WAVE', 'FOAM', 'FUJI', 'BOATS', 'SPRAY', 'CLOUDS', 'OARSMEN'],
    art: {
      slug: 'the-great-wave-off-kanagawa-hokusai',
      title: 'The Great Wave off Kanagawa',
      artist: 'Katsushika Hokusai',
      year: 'c. 1831',
      holder: 'The Metropolitan Museum of Art, New York',
      credit: 'CC0 · The Met Open Access',
      story:
        'Hokusai was about seventy when he made this woodblock print of a giant wave about to crash over three fast boats off the coast of Kanagawa. The oarsmen bow their heads and hold on; the foam breaks into curling claws. Far behind, small and calm, sits Mount Fuji, the sacred mountain the whole series was about. Because prints were cheap, thousands of copies were sold, and the wave travelled the world, inspiring Van Gogh, Monet and Debussy.',
    },
  },
  {
    id: 'pearl-earring',
    room: 'icons',
    rows: 8,
    cols: 6,
    words: ['PEARL', 'EARRING', 'TURBAN', 'GAZE', 'COLLAR', 'SHOULDER', 'YELLOW', 'JACKET'],
    art: {
      slug: 'girl-with-a-pearl-earring-vermeer',
      title: 'Girl with a Pearl Earring',
      artist: 'Johannes Vermeer',
      year: 'c. 1665',
      holder: 'Mauritshuis, The Hague',
      credit: 'Public domain · image via Wikimedia Commons',
      story:
        'A girl turns to look over her shoulder, lips parted, as if we had just called her name. Nobody knows who she was. Vermeer did not paint a portrait but a "tronie", a study of a face and an exotic costume: a blue and yellow turban, a plain white collar, and a pearl far too large to be real, probably glass, made with two quick touches of white paint. Vermeer worked slowly in Delft and left only about 35 paintings.',
    },
  },
  {
    id: 'sudden-shower',
    room: 'icons',
    rows: 7,
    cols: 5,
    words: ['BRIDGE', 'UMBRELLA', 'RIVER', 'RAFT', 'DOWNPOUR', 'HATS'],
    art: {
      slug: 'sudden-shower-over-shin-ohashi-bridge-hiroshige',
      title: 'Sudden Shower over Shin-Ōhashi Bridge',
      artist: 'Utagawa Hiroshige',
      year: '1857',
      holder: 'The Metropolitan Museum of Art, New York',
      credit: 'CC0 · The Met Open Access',
      story:
        'A summer storm breaks over the great bridge across the Sumida River in Edo, today\'s Tokyo. The rain falls in fine dark lines, people hurry across under umbrellas and straw hats, and a lone raftsman poles his logs down the grey river. It is one of the One Hundred Famous Views of Edo, made the year before Hiroshige died. Van Gogh loved it so much that he copied it in oil paint, framed with Japanese characters.',
    },
  },
];
