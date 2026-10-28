// Reachmark Audio — task-first workspace dashboard.
import { h, icon, icons, state, save, navigate, toast, routes, db, fmtDate, download, modal, playerNode } from './core.js';
import { Player } from './audio.js';

const tools = [
  ['/studio/tts', 'audioLines', 'Text to Speech', 'Turn a script into a voice track', 'Create'],
  ['/studio/clone', 'fingerprint', 'Voice Match', 'Build a reusable voice from a sample', 'Voice'],
  ['/studio/design', 'wandSparkles', 'Voice Design', 'Shape a new voice with a description', 'Voice'],
  ['/studio/changer', 'audioWaveform', 'Voice Changer', 'Transform an existing recording', 'Audio'],
  ['/studio/transcribe', 'audioFile', 'Transcribe audio', 'Turn a recording into editable text', 'Audio'],
  ['/studio/dub', 'languages', 'Dubbing Studio', 'Translate and re-voice your video', 'Video'],
  ['/studio/lip', 'video', 'Lip Sync Studio', 'Sync a character to your audio', 'Video'],
  ['/studio/separate', 'sliders', 'Vocal removal', 'Separate vocals from a stereo mix', 'Audio'],
];

routes['/home'] = {
  title: 'Workspace', tab: 'home',
  top: () => ({
    left: h('div', { class: 'workspace-top-label' }, 'YOUR WORKSPACE'),
    actions: [
      h('button', { class: 'iconbtn', 'aria-label': 'Open command palette', onclick: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })) }, icon('search')),
      h('button', { class: 'iconbtn', 'aria-label': 'Open support', onclick: () => navigate('/support') }, icon('lifebuoy')),
    ],
  }),
  view: async ({ node }) => {
    const first = (db.user?.name || 'creator').split(' ')[0];
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const history = [...(db.history || [])].sort((a, b) => (b.at || 0) - (a.at || 0));
    const stat = (ic, value, label, tone = '') => h('div', { class: 'workspace-stat' },
      h('span', { class: 'workspace-stat-icon ' + tone }, icon(ic)),
      h('div', {}, h('b', {}, value), h('small', {}, label)));
    const hero = h('section', { class: 'workspace-hero' },
      h('div', { class: 'workspace-hero-copy' },
        h('span', { class: 'workspace-kicker' }, icon('spark'), ' REACHMARK AUDIO WORKSPACE'),
        h('h1', {}, greeting + ', ' + first + '.'),
        h('p', {}, 'Pick up where you left off, or start something new. Your voice tools, recordings and creative workflows live here.'),
        h('div', { class: 'workspace-hero-actions' },
          h('button', { class: 'btn primary', onclick: () => navigate('/studio/tts') }, icon('plus'), ' Create a project'),
          h('button', { class: 'btn', onclick: () => navigate('/studio/transcribe') }, icon('audioFile'), ' Transcribe audio')),
        h('div', { class: 'workspace-proofline' }, icon('shieldCheck'), ' Your workspace · Your saved voices · Your output history')),
      h('div', { class: 'workspace-hero-art', 'aria-hidden': 'true' },
        h('div', { class: 'workspace-orbit orbit-one' }),
        h('div', { class: 'workspace-orbit orbit-two' }),
        h('div', { class: 'workspace-wave' }, [3, 7, 11, 17, 24, 15, 9, 20, 28, 17, 11, 22, 15, 8, 18, 25, 12, 6, 16, 9, 4].map(n => h('i', { style: { height: n + 'px' } }))),
        h('span', { class: 'workspace-art-label' }, 'VOICE / SOUND / STORY')));
    const stats = h('div', { class: 'workspace-stats' },
      stat('spark', (db.user?.credits ?? 0).toLocaleString(), 'Credits available', 'lime'),
      stat('fingerprint', String(db.voices?.length || 0), 'Saved voices', 'vio'),
      stat('audioWaveform', String(history.length), 'Recent outputs', 'cyan'),
      stat('clock', (db.user?.minutes || 0).toFixed(1), 'Studio minutes', 'orange'));
    let activeFilter = 'All';
    const filters = ['All', 'tts', 'vc', 'dub', 'lip', 'sep', 'clone', 'design'];
    const filterLabel = { tts: 'Speech', vc: 'Voice changer', dub: 'Dubbing', lip: 'Lip sync', sep: 'Vocal removal', clone: 'Voice match', design: 'Voice design' };
    const filterRow = h('div', { class: 'workspace-filters' });
    const recentList = h('div', { class: 'workspace-recent-list' });
    const renderRecent = () => {
      filterRow.replaceChildren(...filters.map(f => h('button', {
        class: 'workspace-filter' + (activeFilter === f ? ' active' : ''),
        onclick: () => { activeFilter = f; renderRecent(); },
      }, f === 'All' ? 'All work' : (filterLabel[f] || f))));
      recentList.replaceChildren();
      const items = history.filter(item => activeFilter === 'All' || item.kind === activeFilter).slice(0, 6);
      if (!items.length) {
        recentList.append(h('div', { class: 'workspace-empty' },
          h('span', { class: 'workspace-empty-icon' }, icon('audioWaveform')),
          h('b', {}, activeFilter === 'All' ? 'Your next project starts here' : 'No ' + (filterLabel[activeFilter] || activeFilter) + ' yet'),
          h('p', {}, 'Create something and your saved outputs will appear here for quick playback and download.'),
          h('button', { class: 'btn', onclick: () => navigate(activeFilter === 'All' ? '/studio/tts' : ({ tts:'/studio/tts', vc:'/studio/changer', dub:'/studio/dub', lip:'/studio/lip', sep:'/studio/separate', clone:'/studio/clone', design:'/studio/design' })[activeFilter] || '/studio/tts') }, 'Start creating', icon('arrowUpRight'))));
        return;
      }
      for (const item of items) {
        const label = filterLabel[item.kind] || item.kind || 'Project';
        const row = h('article', { class: 'workspace-output' },
          h('span', { class: 'workspace-output-icon' }, icon(({ tts:'audioLines', vc:'audioWaveform', dub:'languages', lip:'video', sep:'sliders', clone:'fingerprint', design:'wandSparkles' })[item.kind] || 'audioFile')),
          h('div', { class: 'workspace-output-main' },
            h('b', {}, item.title || 'Untitled output'),
            h('span', {}, label + ' · ' + (item.at ? fmtDate(item.at) : 'Saved output'))),
          h('div', { class: 'workspace-output-actions' },
            item.url ? h('button', { class: 'iconbtn', 'aria-label': 'Play ' + (item.title || 'output'), onclick: () => {
              modal('Preview · ' + (item.title || 'output'), box => { const p = playerNode(); const player = new Player(p.canvas, p.pbtn, p.time); box.append(p.node); player.load(item.url).then(() => player.play()); });
            } }, icon('play')) : null,
            item.url ? h('button', { class: 'iconbtn', 'aria-label': 'Download ' + (item.title || 'output'), onclick: () => download(item.url, (item.title || 'reachmark-output').replace(/[^a-z0-9_-]+/gi, '_') + '.wav') }, icon('download')) : null));
        recentList.append(row);
      }
    };
    const toolGrid = h('div', { class: 'workspace-tool-grid' }, tools.map(([path, ic, name, desc, category]) =>
      h('button', { class: 'workspace-tool-card', onclick: () => navigate(path) },
        h('span', { class: 'workspace-tool-icon' }, icon(ic)),
        h('span', { class: 'workspace-tool-category' }, category),
        h('b', {}, name),
        h('small', {}, desc),
        h('span', { class: 'workspace-tool-arrow' }, icon('arrowUpRight')))));
    const side = h('aside', { class: 'workspace-side-stack' },
      h('section', { class: 'workspace-side-card' },
        h('div', { class: 'workspace-section-head' }, h('div', {}, h('span', { class: 'workspace-kicker' }, 'YOUR LIBRARY'), h('h2', {}, 'Saved voices')), h('button', { class: 'text-link', onclick: () => navigate('/account') }, 'Manage')),
        h('div', { class: 'workspace-voice-list' }, ...(db.voices || []).slice(0, 4).map(v =>
          h('button', { class: 'workspace-voice-row', onclick: () => { state.defaultVoiceId = v.id; save(); navigate('/studio/tts'); } },
            h('span', { class: 'workspace-voice-avatar' }, (v.name || 'V').slice(0,1).toUpperCase()),
            h('span', {}, h('b', {}, v.name || 'Saved voice'), h('small', {}, v.kind === 'clone' ? 'Voice match' : (v.kind || 'Voice'))),
            icon('chevronRight'))),
          ...((db.voices || []).length ? [] : [h('p', { class: 'workspace-muted' }, 'Your saved voices will appear here. Create a voice match or design a new voice to build your library.')]),
          h('button', { class: 'workspace-inline-action', onclick: () => navigate('/studio/clone') }, icon('plus'), ' Add a voice'))),
      h('section', { class: 'workspace-side-card workspace-guide-card' },
        h('span', { class: 'workspace-kicker' }, 'NEED A STARTING POINT?'),
        h('h2', {}, 'Choose a workflow'),
        h('p', {}, 'Start with a script, an audio file, or a video. Reachmark will take you to the right studio.'),
        h('button', { class: 'workspace-guide-row', onclick: () => navigate('/studio/tts') }, icon('fileText'), h('span', {}, h('b', {}, 'I have a script'), h('small', {}, 'Generate narration or dialogue')), icon('chevronRight')),
        h('button', { class: 'workspace-guide-row', onclick: () => navigate('/studio/transcribe') }, icon('audioFile'), h('span', {}, h('b', {}, 'I have a recording'), h('small', {}, 'Transcribe speech to text')), icon('chevronRight')),
        h('button', { class: 'workspace-guide-row', onclick: () => navigate('/studio/dub') }, icon('video'), h('span', {}, h('b', {}, 'I have a video'), h('small', {}, 'Translate and re-voice content')), icon('chevronRight'))));
    const recentSection = h('section', { class: 'workspace-panel' },
      h('div', { class: 'workspace-section-head' },
        h('div', {}, h('span', { class: 'workspace-kicker' }, 'PICK UP WHERE YOU LEFT OFF'), h('h2', {}, 'Recent work')),
        h('span', { class: 'workspace-live-label' }, icon('checkCircle'), ' Saved to your account')),
      filterRow, recentList);
    const toolsSection = h('section', { class: 'workspace-tools-section' },
      h('div', { class: 'workspace-section-head' },
        h('div', {}, h('span', { class: 'workspace-kicker' }, 'THE CREATIVE TOOLKIT'), h('h2', {}, 'Choose your next move')),
        h('span', { class: 'workspace-tool-count' }, tools.length + ' studios')),
      toolGrid);
    renderRecent();
    node.append(hero, stats, h('div', { class: 'workspace-layout' }, h('div', { class: 'workspace-main-stack' }, toolsSection, recentSection), side));
  },
};
