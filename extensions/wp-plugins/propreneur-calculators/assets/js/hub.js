(function () {
    function resizeIframe(iframe, minHeight) {
        if (!iframe) return;
        window.addEventListener('message', function (event) {
            var data = event.data;
            if (!data || data.type !== 'propreneur-calculator-resize') return;
            if (typeof data.height !== 'number' || data.height < 200) return;
            iframe.style.minHeight = Math.max(minHeight, data.height) + 'px';
        });
    }

    function initHub(root) {
        var picks = root.querySelectorAll('.propreneur-calculators-hub__pick');
        var iframe = root.querySelector('.propreneur-calculators-hub__iframe');
        var labelEl = root.querySelector('[data-active-label]');
        var defaultSlug = root.getAttribute('data-default') || '';
        var minHeight = parseInt(root.getAttribute('data-height') || '880', 10) || 880;

        if (!iframe || !picks.length) return;

        resizeIframe(iframe, minHeight);

        function activate(button) {
            picks.forEach(function (btn) { btn.classList.remove('is-active'); });
            button.classList.add('is-active');
            iframe.src = button.getAttribute('data-embed-url') || '';
            if (labelEl) {
                labelEl.textContent = button.getAttribute('data-label') || '';
            }
        }

        picks.forEach(function (button) {
            button.addEventListener('click', function () { activate(button); });
        });

        var initial = null;
        picks.forEach(function (button) {
            if (button.getAttribute('data-slug') === defaultSlug) {
                initial = button;
            }
        });
        activate(initial || picks[0]);
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.propreneur-calculators-hub').forEach(initHub);
        document.querySelectorAll('.propreneur-calculator-embed__iframe').forEach(function (iframe) {
            resizeIframe(iframe, parseInt(iframe.style.minHeight, 10) || 880);
        });
    });
})();
