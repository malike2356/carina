(function () {
  const API = '/api/images';
  const PAGE_SIZE = 24;

  let images = [];
  let page = 1;
  let hasMore = false;
  let loading = false;
  let activeImage = null;
  let selectedWidth = 1024;
  let selectedHeight = 1024;
  let providerInfo = {
    models: [],
    generationConfigured: false,
    inpaintSupported: false,
    backgroundRemovalConfigured: false,
  };

  const gridEl = document.getElementById('gallery-grid');
  const emptyEl = document.getElementById('empty-state');
  const loadMoreWrapEl = document.getElementById('load-more-wrap');
  const loadMoreBtn = document.getElementById('load-more');
  const statusEl = document.getElementById('status');
  const promptInputEl = document.getElementById('prompt-input');
  const modelSelectEl = document.getElementById('model-select');
  const generateBtn = document.getElementById('generate-btn');
  const providerHintEl = document.getElementById('provider-hint');
  const sizePresetsEl = document.getElementById('size-presets');
  const lightboxEl = document.getElementById('lightbox');
  const lightboxImgEl = document.getElementById('lightbox-img');
  const lightboxPromptEl = document.getElementById('lightbox-prompt');
  const lightboxModelEl = document.getElementById('lightbox-model');
  const lightboxSizeEl = document.getElementById('lightbox-size');
  const lightboxDateEl = document.getElementById('lightbox-date');
  const inpaintPanelEl = document.getElementById('inpaint-panel');
  const inpaintPromptEl = document.getElementById('inpaint-prompt');
  const inpaintMaskEl = document.getElementById('inpaint-mask');
  const inpaintSubmitEl = document.getElementById('inpaint-submit');
  const toastEl = document.getElementById('toast');

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.style.display = 'block';
    setTimeout(function () { toastEl.style.display = 'none'; }, 4500);
  }

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Request failed: ' + res.status));
    return data;
  }

  function truncate(text, max) {
    if (!text || text.length <= max) return text || '';
    return text.slice(0, max - 1) + '\u2026';
  }

  function renderThumb(image) {
    const card = document.createElement('article');
    card.className = 'thumb-card';
    card.dataset.id = image.id;

    card.innerHTML =
      '<img src="' + escapeHtml(image.url) + '" alt="' + escapeHtml(truncate(image.prompt, 80)) + '" loading="lazy">' +
      '<div class="thumb-overlay">' +
        '<div class="thumb-prompt">' + escapeHtml(truncate(image.prompt, 120)) + '</div>' +
        '<div class="thumb-actions">' +
          '<button type="button" data-copy="' + escapeHtml(image.id) + '">Copy prompt</button>' +
          '<button type="button" class="danger" data-delete="' + escapeHtml(image.id) + '">Delete</button>' +
        '</div>' +
      '</div>';

    card.addEventListener('click', function (event) {
      const target = event.target;
      if (target && target.matches('button[data-copy]')) {
        event.stopPropagation();
        copyPrompt(image.prompt);
        return;
      }
      if (target && target.matches('button[data-delete]')) {
        event.stopPropagation();
        deleteImage(image.id);
        return;
      }
      openLightbox(image.id);
    });

    return card;
  }

  function renderGrid(append) {
    if (!append) gridEl.innerHTML = '';
    images.forEach(function (image) {
      if (append && gridEl.querySelector('[data-id="' + image.id + '"]')) return;
      gridEl.appendChild(renderThumb(image));
    });
    emptyEl.hidden = images.length > 0;
    loadMoreWrapEl.hidden = !hasMore;
  }

  async function loadModels() {
    providerInfo = await api('GET', '/models');
    modelSelectEl.innerHTML = '';
    const models = providerInfo.models && providerInfo.models.length
      ? providerInfo.models
      : ['dall-e-3'];
    models.forEach(function (model) {
      const opt = document.createElement('option');
      opt.value = model;
      opt.textContent = model;
      modelSelectEl.appendChild(opt);
    });

    const hints = [];
    if (!providerInfo.generationConfigured) {
      hints.push('Set OPENAI_API_KEY to enable generation.');
    }
    if (!providerInfo.inpaintSupported) {
      hints.push('Inpaint needs OpenAI (DALL-E 2 edit).');
    }
    if (!providerInfo.backgroundRemovalConfigured) {
      hints.push('Set REMOVE_BG_API_KEY for background removal.');
    }
    providerHintEl.textContent = hints.join(' ');
    generateBtn.disabled = !providerInfo.generationConfigured;
  }

  async function loadImages(reset) {
    if (loading) return;
    loading = true;
    if (reset) {
      page = 1;
      images = [];
    }
    setStatus('Loading...');
    try {
      const data = await api('GET', '/?page=' + page + '&limit=' + PAGE_SIZE);
      const batch = data.images || [];
      if (reset) {
        images = batch;
      } else {
        images = images.concat(batch);
      }
      hasMore = Boolean(data.hasMore);
      renderGrid(!reset);
      setStatus(images.length + ' image' + (images.length === 1 ? '' : 's'));
    } catch (err) {
      setStatus('');
      showToast(err.message || 'Failed to load images');
    } finally {
      loading = false;
    }
  }

  async function generateImage() {
    const prompt = promptInputEl.value.trim();
    if (!prompt) {
      showToast('Enter a prompt first');
      return;
    }
    generateBtn.disabled = true;
    setStatus('Generating...');
    try {
      const created = await api('POST', '/generate', {
        prompt: prompt,
        model: modelSelectEl.value,
        width: selectedWidth,
        height: selectedHeight,
      });
      images.unshift(created);
      renderGrid(false);
      emptyEl.hidden = true;
      setStatus(images.length + ' images');
      showToast('Image generated');
      openLightbox(created.id);
    } catch (err) {
      showToast(err.message || 'Generation failed');
    } finally {
      generateBtn.disabled = !providerInfo.generationConfigured;
    }
  }

  function findImage(id) {
    return images.find(function (img) { return img.id === id; }) || null;
  }

  function openLightbox(id) {
    const image = findImage(id);
    if (!image) return;
    activeImage = image;
    lightboxImgEl.src = image.url;
    lightboxPromptEl.textContent = image.prompt || '';
    lightboxModelEl.textContent = image.model ? 'Model: ' + image.model : 'Model: unknown';
    const size = image.width && image.height ? image.width + ' x ' + image.height : 'Size: unknown';
    lightboxSizeEl.textContent = size;
    lightboxDateEl.textContent = image.createdAt
      ? new Date(image.createdAt).toLocaleString()
      : '';
    inpaintPanelEl.classList.remove('open');
    inpaintPromptEl.value = '';
    inpaintMaskEl.value = '';
    document.getElementById('lb-inpaint-toggle').disabled = !providerInfo.inpaintSupported;
    document.getElementById('lb-remove-bg').disabled = !providerInfo.backgroundRemovalConfigured;
    lightboxEl.classList.add('open');
  }

  function closeLightbox() {
    lightboxEl.classList.remove('open');
    activeImage = null;
  }

  function copyPrompt(text) {
    navigator.clipboard.writeText(text || '').then(function () {
      showToast('Prompt copied');
    }).catch(function () {
      showToast('Could not copy prompt');
    });
  }

  async function deleteImage(id) {
    if (!confirm('Delete this image?')) return;
    try {
      await api('DELETE', '/' + id);
      images = images.filter(function (img) { return img.id !== id; });
      renderGrid(false);
      if (activeImage && activeImage.id === id) closeLightbox();
      setStatus(images.length + ' images');
      showToast('Image deleted');
    } catch (err) {
      showToast(err.message || 'Delete failed');
    }
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function runInpaint() {
    if (!activeImage) return;
    const prompt = inpaintPromptEl.value.trim();
    const maskFile = inpaintMaskEl.files && inpaintMaskEl.files[0];
    if (!prompt || !maskFile) {
      showToast('Inpaint needs a prompt and mask PNG');
      return;
    }
    inpaintSubmitEl.disabled = true;
    setStatus('Inpainting...');
    try {
      const mask = await fileToBase64(maskFile);
      const created = await api('POST', '/' + activeImage.id + '/inpaint', { prompt: prompt, mask: mask });
      images.unshift(created);
      renderGrid(false);
      showToast('Inpaint complete');
      openLightbox(created.id);
    } catch (err) {
      showToast(err.message || 'Inpaint failed');
    } finally {
      inpaintSubmitEl.disabled = false;
      setStatus(images.length + ' images');
    }
  }

  async function removeBackground() {
    if (!activeImage) return;
    setStatus('Removing background...');
    try {
      const created = await api('POST', '/' + activeImage.id + '/remove-background');
      images.unshift(created);
      renderGrid(false);
      showToast('Background removed');
      openLightbox(created.id);
    } catch (err) {
      showToast(err.message || 'Background removal failed');
    } finally {
      setStatus(images.length + ' images');
    }
  }

  sizePresetsEl.addEventListener('click', function (event) {
    const btn = event.target.closest('.preset-btn');
    if (!btn) return;
    sizePresetsEl.querySelectorAll('.preset-btn').forEach(function (el) {
      el.classList.remove('active');
    });
    btn.classList.add('active');
    selectedWidth = Number(btn.dataset.w) || 1024;
    selectedHeight = Number(btn.dataset.h) || 1024;
  });

  generateBtn.addEventListener('click', generateImage);
  loadMoreBtn.addEventListener('click', function () {
    page += 1;
    loadImages(false);
  });

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  lightboxEl.addEventListener('click', function (event) {
    if (event.target === lightboxEl) closeLightbox();
  });
  document.getElementById('lb-copy-prompt').addEventListener('click', function () {
    if (activeImage) copyPrompt(activeImage.prompt);
  });
  document.getElementById('lb-use-prompt').addEventListener('click', function () {
    if (!activeImage) return;
    promptInputEl.value = activeImage.prompt || '';
    closeLightbox();
    promptInputEl.focus();
  });
  document.getElementById('lb-download').addEventListener('click', function () {
    if (!activeImage) return;
    const link = document.createElement('a');
    link.href = activeImage.url;
    link.download = activeImage.id + '.png';
    link.click();
  });
  document.getElementById('lb-inpaint-toggle').addEventListener('click', function () {
    inpaintPanelEl.classList.toggle('open');
  });
  document.getElementById('lb-remove-bg').addEventListener('click', removeBackground);
  document.getElementById('lb-delete').addEventListener('click', function () {
    if (activeImage) deleteImage(activeImage.id);
  });
  inpaintSubmitEl.addEventListener('click', runInpaint);

  var uploadInput = document.getElementById('upload-input');
  var uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn && uploadInput) {
    uploadBtn.addEventListener('click', function () {
      var file = uploadInput.files && uploadInput.files[0];
      if (!file) {
        showToast('Choose an image file first');
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var data = String(reader.result || '');
        var base64 = data.indexOf(',') >= 0 ? data.slice(data.indexOf(',') + 1) : data;
        setStatus('Uploading...');
        api('POST', '/upload', {
          data: base64,
          prompt: 'Uploaded: ' + file.name,
        }).then(function (created) {
          images.unshift(created);
          renderGrid(false);
          emptyEl.hidden = true;
          uploadInput.value = '';
          setStatus(images.length + ' images');
          showToast('Image uploaded');
          openLightbox(created.id);
        }).catch(function (err) {
          showToast(err.message || 'Upload failed');
          setStatus('');
        });
      };
      reader.readAsDataURL(file);
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && lightboxEl.classList.contains('open')) closeLightbox();
  });

  // Show skeleton grid while images load
  gridEl.innerHTML = [1, 2, 3, 4, 5, 6].map(() =>
    '<div class="skeleton" style="height:160px;border-radius:10px;"></div>',
  ).join('');

  loadModels()
    .then(function () { return loadImages(true); })
    .catch(function (err) { showToast(err.message || 'Failed to initialize gallery'); });
})();
