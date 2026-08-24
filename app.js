(() => {
  const C = window.RIAFLIX_CONFIG;
  const $ = selector => document.querySelector(selector);
  const opening = $('#opening'), profiles = $('#profiles'), main = $('#main');
  const player = $('#player'), finale = $('#finale');

  // Profile selection.
  const profileList = $('#profileList');
  (C.profiles || [{ name: 'Ria 1', image: '1.jpg' }]).forEach(profile => {
    const button = document.createElement('button');
    button.className = 'profile';
    button.setAttribute('aria-label', `Select ${profile.name}`);
    button.innerHTML = `<span class="avatar"><img src="${profile.image}" alt=""></span>${profile.showName === false ? '' : `<strong>${profile.name}</strong>`}`;
    button.querySelector('img').onerror = event => event.currentTarget.remove();
    profileList.append(button);
  });
  document.documentElement.style.setProperty('--hero', `url("${C.heroImage}")`);
  const revealProfiles = () => {
    opening.classList.add('leaving');
    setTimeout(() => { opening.hidden = true; profiles.hidden = false; profileList.querySelector('.profile')?.focus(); }, 650);
  };
  setTimeout(revealProfiles, matchMedia('(prefers-reduced-motion: reduce)').matches ? 500 : C.openingDuration);

  // Two video layers crossfade through Vid 1, Vid 2, and Vid 3 continuously.
  const heroVideos = [$('#heroVideoA'), $('#heroVideoB')];
  const heroVideoPlay = $('#heroVideoPlay');
  const heroSources = C.heroVideos || [];
  const failedHeroSources = new Set();
  let activeHero = 0, heroIndex = 0, heroStarted = false;
  const showHeroFallback = () => { heroVideos.forEach(video => video.hidden = true); heroVideoPlay.hidden = true; };
  const playHeroLayer = (slot, index, fade = false) => {
    if (!heroSources.length) return showHeroFallback();
    const video = heroVideos[slot], source = heroSources[index];
    video.hidden = false; video.src = source; video.muted = true; video.load();
    video.onended = advanceHero;
    video.onerror = () => {
      failedHeroSources.add(source);
      if (failedHeroSources.size >= heroSources.length) return showHeroFallback();
      advanceHero();
    };
    const begin = () => video.play().then(() => {
      heroVideoPlay.hidden = true;
      if (fade) {
        const previous = heroVideos[activeHero];
        video.classList.add('active'); previous.classList.remove('active'); activeHero = slot;
        setTimeout(() => { previous.pause(); try { previous.currentTime = 0; } catch {} }, 950);
      }
    }).catch(() => heroVideoPlay.hidden = false);
    if (video.readyState >= 2) begin();
    else video.oncanplay = () => { video.oncanplay = null; begin(); };
  };
  function advanceHero() {
    let attempts = 0;
    do { heroIndex = (heroIndex + 1) % heroSources.length; attempts++; }
    while (failedHeroSources.has(heroSources[heroIndex]) && attempts <= heroSources.length);
    if (attempts > heroSources.length) return showHeroFallback();
    playHeroLayer(1 - activeHero, heroIndex, true);
  }
  const startHero = () => {
    if (!heroStarted) { heroStarted = true; playHeroLayer(activeHero, heroIndex); }
    else heroVideos[activeHero].play().catch(() => heroVideoPlay.hidden = false);
  };
  const pauseHero = () => heroVideos.forEach(video => video.pause());
  heroVideoPlay.onclick = () => heroVideos[activeHero].play().then(() => heroVideoPlay.hidden = true);
  let cursorElement = null, cursorFrame = null, cursorMoveResolve = null, cursorTimer = null, cursorRunId = 0, cursorFollowCleanup = null;
  const cursorWasShown = () => { try { return sessionStorage.getItem('nextflixCursorShown') === '1'; } catch { return false; } };
  const markCursorShown = () => { try { sessionStorage.setItem('nextflixCursorShown', '1'); } catch {} };
  const cancelCursor = () => {
    cursorRunId++; clearTimeout(cursorTimer); cancelAnimationFrame(cursorFrame); cursorMoveResolve?.(false); cursorFollowCleanup?.(); cursorElement?.remove();
    $('#play').classList.remove('auto-hover', 'auto-pulse', 'auto-press', 'auto-click');
    cursorElement = null; cursorFrame = null; cursorMoveResolve = null; cursorFollowCleanup = null;
  };
  const cursorDelay = (milliseconds, runId) => new Promise(resolve => {
    cursorTimer = setTimeout(() => resolve(runId === cursorRunId), milliseconds);
  });
  const waitForPlayLayout = async runId => {
    for (let frame = 0; frame < 12; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (runId !== cursorRunId) return false;
      const rect = $('#play')?.getBoundingClientRect();
      if (rect?.width > 0 && rect?.height > 0) return true;
    }
    return false;
  };
  const buttonCenter = button => {
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const moveCursorToButton = (button, start, runId) => new Promise(resolve => {
    let startedAt = null, settled = false;
    const finish = result => {
      if (settled) return; settled = true; cursorMoveResolve = null; resolve(result);
    };
    cursorMoveResolve = finish;
    const step = timestamp => {
      if (runId !== cursorRunId || !cursorElement) return finish(false);
      if (startedAt === null) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / 2000);
      const eased = 1 - Math.pow(1 - progress, 3);
      const target = buttonCenter(button);
      const x = start.x + (target.x - start.x) * eased;
      const y = start.y + (target.y - start.y) * eased;
      cursorElement.style.transform = `translate3d(${x}px,${y}px,0) rotate(-8deg)`;
      if (progress < 1) cursorFrame = requestAnimationFrame(step);
      else finish(true);
    };
    cursorFrame = requestAnimationFrame(step);
  });
  const runCursorStory = async () => {
    if (cursorWasShown()) return;
    markCursorShown();
    const runId = ++cursorRunId;
    if (!await waitForPlayLayout(runId)) return;
    if (!await cursorDelay(1500, runId)) return;

    const playButton = $('#play');
    const usePulse = matchMedia('(max-width: 699px), (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)').matches;
    if (usePulse) {
      playButton.classList.add('auto-pulse');
      if (!await cursorDelay(900, runId)) return;
      playButton.classList.remove('auto-pulse');
      if (runId === cursorRunId) openPlayer();
      return;
    }

    const start = { x: Math.max(30, innerWidth * .82), y: Math.max(80, innerHeight * .78) };
    cursorElement = document.createElement('div'); cursorElement.className = 'cinematic-cursor'; cursorElement.setAttribute('aria-hidden', 'true');
    cursorElement.style.transform = `translate3d(${start.x}px,${start.y}px,0) rotate(-8deg)`;
    document.body.append(cursorElement);
    if (!await cursorDelay(150, runId)) return;
    if (!await moveCursorToButton(playButton, start, runId)) return;

    const followTarget = () => {
      if (!cursorElement || runId !== cursorRunId) return;
      const target = buttonCenter(playButton);
      cursorElement.style.transform = `translate3d(${target.x}px,${target.y}px,0) rotate(-8deg)`;
    };
    addEventListener('resize', followTarget); addEventListener('scroll', followTarget, true);
    cursorFollowCleanup = () => { removeEventListener('resize', followTarget); removeEventListener('scroll', followTarget, true); };
    followTarget();

    playButton.classList.add('auto-hover');
    if (!await cursorDelay(500, runId)) return;
    followTarget(); cursorElement?.classList.add('click-down', 'clicking'); playButton.classList.add('auto-press', 'auto-click');
    if (!await cursorDelay(180, runId)) return;
    cursorElement?.classList.remove('click-down'); cursorElement?.classList.add('click-release'); playButton.classList.remove('auto-press');
    if (!await cursorDelay(220, runId)) return;
    cursorElement?.classList.add('fading');
    playButton.classList.remove('auto-hover', 'auto-click'); cursorFollowCleanup?.(); cursorFollowCleanup = null;
    if (!await cursorDelay(180, runId)) return;
    if (runId !== cursorRunId) return;
    cursorElement?.remove(); cursorElement = null; cursorFrame = null;
    openPlayer();
  };
  profileList.onclick = event => {
    if (!event.target.closest('.profile')) return;
    startHero(); profiles.classList.add('leaving');
    setTimeout(() => { profiles.hidden = true; main.hidden = false; requestAnimationFrame(() => main.classList.add('visible')); $('#play').focus(); runCursorStory(); }, 450);
  };

  // Responsive cinematic memory rows.
  const rows = $('#rows');
  const logoPalettes = [
    ['#09030a','#64152c','#ffc38d'], ['#10060e','#76274a','#ffd8b0'], ['#190806','#b84a22','#ffd17e'],
    ['#040713','#243f76','#f6b6c8'], ['#110609','#5a101d','#eeb7a5'], ['#080711','#362b68','#ffb1c9'],
    ['#09050e','#7a2143','#ffd0dc'], ['#020712','#165577','#c6eaff'], ['#10040a','#a11d39','#ffd2aa'],
    ['#10070a','#6d2418','#f9c47a'], ['#050914','#293b77','#ffbfca'], ['#0b0504','#7d371f','#ffe0af'],
    ['#100604','#c25427','#ffd47f'], ['#030713','#223e78','#f6d5ff'], ['#080510','#6b315f','#ffd6e6'],
    ['#05070b','#28515b','#f1c9a1'], ['#100508','#8b1f35','#ffc7a0'], ['#09040f','#4e236d','#eec6ff']
  ];
  const logoEffects = ['stars','sunset','roses','city','hearts','velvet'];
  const logoTypes = ['serif','script','display'];
  const decorateLogo = (element, item, index) => {
    const palette = logoPalettes[index % logoPalettes.length];
    element.style.setProperty('--logo-dark', palette[0]);
    element.style.setProperty('--logo-color', palette[1]);
    element.style.setProperty('--logo-accent', palette[2]);
    element.classList.add(`effect-${logoEffects[index % logoEffects.length]}`, `logo-${logoTypes[index % logoTypes.length]}`);
    element.innerHTML = `<span class="original-label">${index % 2 ? 'A Birthday Original' : 'A RIAFLIX Original'}</span><strong class="title-logo">${item[0]}</strong><span class="logo-flourish" aria-hidden="true">◆</span>`;
  };
  C.collections.forEach((group, groupIndex) => {
    const section = document.createElement('section'); section.className = 'collection';
    section.innerHTML = `<div class="row-head"><h2>${group.title}</h2><div class="row-progress" aria-label="Row position"></div></div><div class="row-shell"><button class="row-btn left" aria-label="Scroll ${group.title} left">‹</button><div class="rail" tabindex="0" aria-label="${group.title}"></div><button class="row-btn right" aria-label="Scroll ${group.title} right">›</button></div>`;
    const rail = section.querySelector('.rail');
    group.items.forEach((item, itemIndex) => {
      const themeIndex = groupIndex * 6 + itemIndex;
      const card = document.createElement('button'); card.className = 'card logo-card'; card.dataset.g = groupIndex; card.dataset.i = itemIndex; card.dataset.theme = themeIndex; card.setAttribute('aria-label', `${item[0]}. ${item[1]}`);
      const artwork = document.createElement('span'); artwork.className = 'logo-art'; artwork.setAttribute('aria-hidden', 'true'); decorateLogo(artwork, item, themeIndex);
      const copy = document.createElement('span'); copy.className = 'card-copy'; copy.innerHTML = `<small>${item[1]}</small>`;
      card.append(artwork, copy); rail.append(card);
    });
    rows.append(section);

    const left = section.querySelector('.left'), right = section.querySelector('.right');
    const indicator = section.querySelector('.row-progress');
    const segmentCount = Math.min(4, Math.max(2, group.items.length));
    indicator.innerHTML = Array.from({ length: segmentCount }, () => '<i></i>').join('');
    const updateRow = () => {
      const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const ratio = max ? rail.scrollLeft / max : 0;
      const active = Math.round(ratio * (segmentCount - 1));
      indicator.querySelectorAll('i').forEach((dot, index) => dot.classList.toggle('active', index === active));
      left.disabled = rail.scrollLeft < 3;
      right.disabled = rail.scrollLeft > max - 3;
    };
    const moveRow = direction => rail.scrollBy({ left: direction * rail.clientWidth * .88, behavior: 'smooth' });
    left.onclick = () => moveRow(-1);
    right.onclick = () => moveRow(1);
    rail.addEventListener('scroll', updateRow, { passive: true });
    rail.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      rail.scrollLeft += event.deltaY;
    }, { passive: false });
    window.addEventListener('resize', updateRow, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(updateRow).observe(rail);
    requestAnimationFrame(updateRow);
  });
  const cardModal = $('#cardModal'); let lastFocus;
  rows.onclick = event => {
    const card = event.target.closest('.card'); if (!card) return; lastFocus = card;
    const item = C.collections[card.dataset.g].items[card.dataset.i];
    const modalArtwork = $('#modalArtwork'); modalArtwork.className = 'modal-artwork logo-art'; decorateLogo(modalArtwork, item, Number(card.dataset.theme));
    $('#modalTitle').textContent = item[0]; $('#modalText').textContent = item[1];
    cardModal.showModal(); cardModal.querySelector('.close').focus();
  };
  cardModal.querySelector('.close').onclick = () => cardModal.close();
  cardModal.onclick = event => { if (event.target === cardModal) cardModal.close(); };
  cardModal.onclose = () => lastFocus?.focus();

  // The finished edit contains its narration, titles, grading, and transitions in one file.
  const finalMovie = $('#finalMovie'), movieSource = $('#movieSource'), movieError = $('#movieError');
  const moviePause = $('#moviePause'), movieVolume = $('#movieVolume');
  $('#masterDownload').href = C.surpriseMaster;
  const updatePauseControl = () => {
    moviePause.innerHTML = finalMovie.paused ? '▶ <span>Resume</span>' : 'Ⅱ <span>Pause</span>';
    moviePause.setAttribute('aria-label', finalMovie.paused ? 'Resume movie' : 'Pause movie');
  };
  let activeMovieSource = C.surpriseMedia, fallbackAttempted = false;
  const showMovieError = message => {
    movieError.textContent = message;
    movieError.hidden = false;
  };
  const loadMovie = (source = C.surpriseMedia, allowFallback = true) => {
    activeMovieSource = source;
    fallbackAttempted = !allowFallback;
    movieError.hidden = true;
    finalMovie.pause();
    movieSource.src = source;
    finalMovie.load();
  };
  const startMovieFromBeginning = () => {
    // Keep the browser-compatible 1080p H.264 edit as the website default.
    loadMovie(C.surpriseMedia, false);
    finalMovie.muted = false; finalMovie.volume = 1;
    finalMovie.play().then(updatePauseControl).catch(error => {
      updatePauseControl();
      showMovieError(error?.name === 'NotAllowedError'
        ? 'Playback needs your permission. Press Resume to start the birthday movie.'
        : 'The birthday movie could not start. Press Replay to try again.');
    });
  };
  let playerOpening = false;
  const openPlayer = () => {
    if (playerOpening || !player.hidden) return;
    playerOpening = true;
    cancelCursor(); pauseHero(); finale.hidden = true; player.hidden = false; document.body.classList.add('locked');
    startMovieFromBeginning(); $('#closePlayer').focus();
    requestAnimationFrame(() => { playerOpening = false; });
  };
  const closePlayer = () => {
    playerOpening = false;
    finalMovie.pause(); try { finalMovie.currentTime = 0; } catch {}
    movieSource.removeAttribute('src'); finalMovie.load(); movieError.hidden = true; player.hidden = true; document.body.classList.remove('locked');
    startHero(); $('#play').focus();
  };
  $('#play').onclick = openPlayer; $('#closePlayer').onclick = closePlayer;
  moviePause.onclick = () => finalMovie.paused ? finalMovie.play() : finalMovie.pause();
  finalMovie.onplay = updatePauseControl; finalMovie.onpause = updatePauseControl;
  finalMovie.onerror = () => {
    // Recover automatically if a future large-screen preference selects the 4K master.
    if (activeMovieSource === C.surpriseMaster && !fallbackAttempted) {
      loadMovie(C.surpriseMedia, false);
      finalMovie.play().catch(() => showMovieError('4K playback is unavailable. The 1080p fallback is ready—press Resume.'));
      return;
    }
    showMovieError('This device could not load the birthday movie. Check the file connection, then press Replay.');
  };
  movieVolume.onclick = () => {
    finalMovie.muted = !finalMovie.muted; const soundOn = !finalMovie.muted;
    movieVolume.setAttribute('aria-pressed', String(!soundOn));
    movieVolume.innerHTML = soundOn ? '🔊 <span>Sound on</span>' : '🔇 <span>Muted</span>';
  };
  $('#movieReplay').onclick = startMovieFromBeginning;
  $('#surpriseFullscreen').onclick = () => document.fullscreenElement ? document.exitFullscreen() : player.requestFullscreen?.();

  const particles = () => {
    const box = $('#particles'); box.innerHTML = '';
    for (let i = 0; i < 70; i++) {
      const particle = document.createElement('i'); particle.textContent = i % 5 === 0 ? '♥' : i % 7 === 0 ? '★' : '';
      particle.style.cssText = `--x:${Math.random() * 100}vw;--d:${2 + Math.random() * 4}s;--delay:${Math.random() * 2}s;--h:${Math.random() * 360}`; box.append(particle);
    }
  };
  const showFinale = () => { finalMovie.pause(); player.hidden = true; finale.hidden = false; particles(); $('#replay').focus(); };
  finalMovie.onended = showFinale;
  $('#replay').onclick = openPlayer;
  addEventListener('keydown', event => { if (!player.hidden && event.key === 'Escape' && !document.fullscreenElement) closePlayer(); });
})();
