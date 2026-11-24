const $ = id => document.getElementById(id);

let channels = [];
let categories = [];
let selectedCategory = 'Tümü';
let menuIndex = 0;
let channelIndex = 0;
let area = 'menu';

const items = [...document.querySelectorAll('.item')];

function clock() {
  $('clock').textContent = new Date().toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

clock();
setInterval(clock, 10000);

function showPage(page) {
  $('channel-panel').style.display = page === 'live' ? 'block' : 'none';
  $('settings-panel').style.display = page === 'settings' ? 'block' : 'none';

  const titles = {
    live: 'CANLI YAYIN',
    movies: 'FİLMLER',
    series: 'DİZİLER',
    settings: 'AYARLAR'
  };

  $('page-title').textContent = titles[page] || 'VEXA PLAYER';

  items.forEach(item => {
    item.classList.toggle('selected', item.dataset.page === page);
  });

  if (page === 'live') area = 'channels';
  else if (page === 'settings') area = 'settings';
  else area = 'menu';
}

function parseAttributes(line) {
  const result = {};
  const regex = /([\w-]+)="([^"]*)"/g;
  let match;

  while ((match = regex.exec(line)) !== null) {
    result[match[1].toLowerCase()] = match[2];
  }

  return result;
}

function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  const seen = new Set();

  let pending = null;
  let skipped = 0;

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      const attrs = parseAttributes(line);
      const name = line.substring(line.lastIndexOf(',') + 1).trim()
        || attrs['tvg-name']
        || '';

      pending = {
        name,
        logo: attrs['tvg-logo'] || attrs['logo'] || '',
        category: attrs['group-title'] || 'Diğer',
        epgId: attrs['tvg-id'] || '',
        number: attrs['tvg-chno'] || ''
      };
      continue;
    }

    if (line.startsWith('#')) continue;

    if (!pending || !pending.name) {
      skipped++;
      pending = null;
      continue;
    }

    try {
      const url = new URL(line);

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        skipped++;
        pending = null;
        continue;
      }

      const key = pending.epgId
        ? 'tvg:' + pending.epgId
        : 'url:' + line;

      if (!seen.has(key)) {
        seen.add(key);

        result.push({
          ...pending,
          url: line
        });
      }
    } catch (e) {
      skipped++;
    }

    pending = null;
  }

  return { channels: result, skipped };
}

function renderCategories() {
  const box = $('category-list');
  box.innerHTML = '';

  const names = ['Tümü', ...categories];

  names.forEach(name => {
    const button = document.createElement('button');
    button.className = 'category';
    button.textContent = name;

    if (name === selectedCategory) {
      button.classList.add('selected');
    }

    button.addEventListener('click', () => {
      selectedCategory = name;
      channelIndex = 0;
      renderCategories();
      renderChannels();
    });

    box.appendChild(button);
  });
}

function renderChannels() {
  const box = $('channel-list');
  box.innerHTML = '';

  const filtered = selectedCategory === 'Tümü'
    ? channels
    : channels.filter(c => c.category === selectedCategory);

  filtered.forEach((channel, index) => {
    const row = document.createElement('div');
    row.className = 'channel';
    row.tabIndex = 0;

    const number = String(index + 1).padStart(2, '0');

    if (channel.logo) {
      const logo = document.createElement('img');
      logo.src = channel.logo;
      logo.className = 'channel-logo';
      logo.onerror = () => logo.style.display = 'none';
      row.appendChild(logo);
    }

    const name = document.createElement('span');
    name.textContent = number + '　' + channel.name;
    row.appendChild(name);

    row.addEventListener('click', () => playChannel(channel));
    row.addEventListener('focus', () => {
      channelIndex = index;
      selectChannelRow();
    });

    box.appendChild(row);
  });

  if (!filtered.length) {
    box.innerHTML = '<p class="empty">Bu kategoride kanal bulunamadı.</p>';
  }

  selectChannelRow();
}

function selectChannelRow() {
  const rows = [...document.querySelectorAll('.channel')];

  rows.forEach((row, index) => {
    row.classList.toggle('selected', index === channelIndex);
  });
}

function playChannel(channel) {
  const video = $('video');

  $('player-name').textContent = channel.name;
  $('player-message').textContent = 'Yayın yükleniyor...';
  $('player-placeholder').style.display = 'none';
  video.style.display = 'block';

  video.src = channel.url;
  video.play().then(() => {
    $('player-message').textContent = 'Yayın oynatılıyor';
  }).catch(() => {
    $('player-placeholder').style.display = 'flex';
    $('player-message').textContent =
      'Yayın açılamadı. Format veya bağlantıyı kontrol edin.';
  });
}

async function loadPlaylist() {
  const url = $('playlist-url').value.trim();

  if (!url) {
    $('playlist-status').textContent = 'Önce M3U bağlantısı girin.';
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    $('playlist-status').textContent = 'Geçerli bir HTTP/HTTPS adresi girin.';
    return;
  }

  $('playlist-status').textContent = 'Playlist indiriliyor...';

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    const text = await response.text();
    const parsed = parseM3U(text);

    if (!parsed.channels.length) {
      throw new Error('Playlist içinde kanal bulunamadı.');
    }

    channels = parsed.channels;
    categories = [...new Set(
      channels.map(c => c.category).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'tr'));

    selectedCategory = 'Tümü';
    channelIndex = 0;

    renderCategories();
    renderChannels();

    $('playlist-status').textContent =
      channels.length + ' kanal yüklendi. Atlanan kayıt: ' + parsed.skipped;

    showPage('live');
  } catch (error) {
    $('playlist-status').textContent =
      'Yükleme hatası: ' + error.message +
      ' (CORS veya sunucu izni engeli olabilir.)';
  }
}

$('save-playlist').addEventListener('click', () => {
  const url = $('playlist-url').value.trim();

  if (!url) {
    $('playlist-status').textContent = 'Önce bağlantı girin.';
    return;
  }

  try {
    localStorage.setItem('vexa_playlist_url', url);
    $('playlist-status').textContent = 'Playlist bağlantısı kaydedildi.';
  } catch (e) {
    $('playlist-status').textContent = 'Cihaza kaydedilemedi.';
  }
});

$('load-playlist').addEventListener('click', loadPlaylist);

items.forEach((item, index) => {
  item.addEventListener('click', () => {
    menuIndex = index;
    showPage(item.dataset.page);
  });
});

try {
  const savedUrl = localStorage.getItem('vexa_playlist_url');
  if (savedUrl) $('playlist-url').value = savedUrl;
} catch (e) {}

showPage('live');

document.addEventListener('keydown', event => {
  const key = event.key;

  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Back'].includes(key)) {
    return;
  }

  event.preventDefault();

  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const direction = key === 'ArrowDown' ? 1 : -1;

    if (area === 'menu') {
      menuIndex = (menuIndex + direction + items.length) % items.length;
      items[menuIndex].focus();
    } else if (area === 'channels') {
      const rows = [...document.querySelectorAll('.channel')];

      if (rows.length) {
        channelIndex = Math.max(0, Math.min(rows.length - 1, channelIndex + direction));
        rows[channelIndex].focus();
      }
    }
  }

  if (key === 'ArrowLeft') {
    if (area === 'channels') {
      area = 'menu';
      items[menuIndex].focus();
    }
  }

  if (key === 'ArrowRight' && area === 'menu') {
    if ($('channel-panel').style.display !== 'none') {
      area = 'channels';
      const rows = [...document.querySelectorAll('.channel')];
      if (rows.length) rows[channelIndex].focus();
    }
  }

  if (key === 'Enter') {
    if (area === 'menu') {
      showPage(items[menuIndex].dataset.page);
    } else if (area === 'channels') {
      const rows = [...document.querySelectorAll('.channel')];
      if (rows[channelIndex]) rows[channelIndex].click();
    }
  }

  if (key === 'Back' || key === 'Escape') {
    showPage('live');
    area = 'menu';
    items[0].focus();
  }
});
