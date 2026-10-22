/**
 * Assistant - iOS Pattern Design Single Page Application
 */

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // Theme Management (Light / Dark Mode - Default: Light)
    // =========================================================================
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleIcon = document.getElementById('themeToggleIcon');

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('assistant_theme', theme);
        } catch (e) {}

        if (themeToggleIcon) {
            if (theme === 'dark') {
                themeToggleIcon.className = 'fas fa-sun';
                if (themeToggleBtn) themeToggleBtn.setAttribute('title', 'Switch to Light Mode');
            } else {
                themeToggleIcon.className = 'fas fa-moon';
                if (themeToggleBtn) themeToggleBtn.setAttribute('title', 'Switch to Dark Mode');
            }
        }
    }

    let currentTheme = 'light';
    try {
        const savedTheme = localStorage.getItem('assistant_theme');
        if (savedTheme === 'dark' || savedTheme === 'light') {
            currentTheme = savedTheme;
        }
    } catch (e) {}
    applyTheme(currentTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
            currentTheme = nextTheme;
            applyTheme(currentTheme);
            showToast(`${nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)} Mode Enabled`, nextTheme === 'dark' ? 'fa-moon' : 'fa-sun');
        });
    }

    // =========================================================================
    // 1. iOS HUD / Dynamic Island Toast Notification
    // =========================================================================
    const hudEl = document.getElementById('iosHud');
    let hudTimeout = null;

    function showToast(message, icon = 'fa-check-circle') {
        if (!hudEl) return;
        clearTimeout(hudTimeout);
        hudEl.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        hudEl.classList.add('show');
        hudTimeout = setTimeout(() => {
            hudEl.classList.remove('show');
        }, 2000);
    }

    // =========================================================================
    // 2. Clipboard Helper
    // =========================================================================
    function copyToClipboard(text, successMsg = 'Copied to Clipboard') {
        if (!text || text.trim() === '') {
            showToast('Nothing to copy', 'fa-exclamation-circle');
            return;
        }

        if (typeof addToHistory === 'function') {
            addToHistory(text);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => showToast(successMsg))
                .catch(() => fallbackCopy(text, successMsg));
        } else {
            fallbackCopy(text, successMsg);
        }
    }

    function fallbackCopy(text, successMsg) {
        const temp = document.createElement('textarea');
        temp.value = text;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        try {
            document.execCommand('copy');
            showToast(successMsg);
        } catch (err) {
            showToast('Failed to copy', 'fa-times-circle');
        }
        document.body.removeChild(temp);
    }

    // =========================================================================
    // 3. iOS Segmented Control Tab Navigation (No Page Reload)
    // =========================================================================
    const segmentedItems = document.querySelectorAll('.ios-segmented-control .segmented-item:not(.phone-type-btn)');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function switchTab(tabId) {
        let targetPanel = document.getElementById(`tab-${tabId}`);

        segmentedItems.forEach(item => {
            const isTarget = item.dataset.tab === tabId;
            item.classList.toggle('active', isTarget);
            item.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        });

        if (!targetPanel && tabPanels.length > 0) {
            targetPanel = tabPanels[0];
            segmentedItems[0].classList.add('active');
            tabId = segmentedItems[0].dataset.tab;
        }

        tabPanels.forEach(panel => {
            panel.classList.remove('active');
        });

        if (targetPanel) {
            targetPanel.classList.add('active');
            if (history.replaceState) {
                history.replaceState(null, null, `#${tabId}`);
            }
        }
    }

    segmentedItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.dataset.tab;
            switchTab(tabId);
        });
    });

    // Check URL hash on initial load
    function initTabFromHash() {
        const hash = window.location.hash.replace('#', '');
        const validTabs = ['password', 'text', 'bullet', 'phone', 'qr', 'dev', 'time', 'color'];
        if (hash && validTabs.includes(hash)) {
            switchTab(hash);
        } else {
            switchTab('password');
        }
    }

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash) switchTab(hash);
    });

    // =========================================================================
    // 4. Password Generator Module
    // =========================================================================
    const pwLengthSlider = document.getElementById('pwLength');
    const pwLengthVal = document.getElementById('pwLengthVal');
    const pwDisplay = document.getElementById('passwordDisplay');
    const pwRegenBtn = document.getElementById('regenPassword');
    const pwCopyBtn = document.getElementById('copyPassword');
    const strengthBar = document.getElementById('strengthProgress');
    const strengthText = document.getElementById('strengthText');

    const optUpper = document.getElementById('optUpper');
    const optLower = document.getElementById('optLower');
    const optNumbers = document.getElementById('optNumbers');
    const optSymbols = document.getElementById('optSymbols');
    const optExcludeAmbiguous = document.getElementById('optExcludeAmbiguous');
    const pwModeBtns = document.querySelectorAll('.pw-mode-btn');

    let currentPwMode = 'random';

    const PASSPHRASE_WORDS = [
        "apple", "orbit", "river", "beacon", "galaxy", "silver", "echo", "breeze",
        "tiger", "falcon", "crypto", "shadow", "winter", "forest", "harbor", "zenith",
        "crystal", "nexus", "quantum", "solace", "timber", "cloud", "meadow", "prairie",
        "starlight", "ember", "delta", "horizon", "shield", "puzzle", "summit", "canyon"
    ];

    const CHARS = {
        upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lower: 'abcdefghijklmnopqrstuvwxyz',
        numbers: '0123456789',
        symbols: '!@#$%^&*()_+[]{}|;:,.<>?'
    };

    function calculateStrength(password) {
        if (!password) return { percent: 0, text: 'None', color: '#636366' };
        let score = 0;
        if (password.length >= 8) score += 20;
        if (password.length >= 14) score += 20;
        if (password.length >= 20) score += 10;
        if (/[A-Z]/.test(password)) score += 15;
        if (/[a-z]/.test(password)) score += 15;
        if (/[0-9]/.test(password)) score += 10;
        if (/[^A-Za-z0-9]/.test(password)) score += 10;

        if (score < 40) {
            return { percent: 30, text: 'Weak', color: '#ff453a' };
        } else if (score < 75) {
            return { percent: 65, text: 'Medium', color: '#ff9f0a' };
        } else {
            return { percent: 100, text: 'Strong', color: '#30d158' };
        }
    }

    function generatePassword() {
        if (currentPwMode === 'passphrase') {
            const count = 4;
            const chosen = [];
            for (let i = 0; i < count; i++) {
                const word = PASSPHRASE_WORDS[Math.floor(Math.random() * PASSPHRASE_WORDS.length)];
                chosen.push(word.charAt(0).toUpperCase() + word.slice(1));
            }
            const num = Math.floor(Math.random() * 90 + 10);
            const password = chosen.join('-') + '-' + num;
            pwDisplay.value = password;
            strengthBar.style.width = '100%';
            strengthBar.style.backgroundColor = '#30d158';
            strengthText.textContent = 'Memorable & Strong';
            strengthText.style.color = '#30d158';
            return;
        }

        const length = parseInt(pwLengthSlider.value, 10);
        let charPool = '';
        let guaranteed = [];

        const cleanSet = (chars) => {
            if (optExcludeAmbiguous && optExcludeAmbiguous.checked) {
                return chars.replace(/[0Ol1I]/g, '');
            }
            return chars;
        };

        if (optUpper.checked) {
            const upper = cleanSet(CHARS.upper);
            if (upper) {
                charPool += upper;
                guaranteed.push(upper[Math.floor(Math.random() * upper.length)]);
            }
        }
        if (optLower.checked) {
            const lower = cleanSet(CHARS.lower);
            if (lower) {
                charPool += lower;
                guaranteed.push(lower[Math.floor(Math.random() * lower.length)]);
            }
        }
        if (optNumbers.checked) {
            const numbers = cleanSet(CHARS.numbers);
            if (numbers) {
                charPool += numbers;
                guaranteed.push(numbers[Math.floor(Math.random() * numbers.length)]);
            }
        }
        if (optSymbols.checked) {
            const symbols = cleanSet(CHARS.symbols);
            if (symbols) {
                charPool += symbols;
                guaranteed.push(symbols[Math.floor(Math.random() * symbols.length)]);
            }
        }

        if (charPool === '') {
            pwDisplay.value = '';
            strengthBar.style.width = '0%';
            strengthText.textContent = 'None';
            strengthText.style.color = '#ff453a';
            return;
        }

        let result = [...guaranteed];
        for (let i = guaranteed.length; i < length; i++) {
            result.push(charPool[Math.floor(Math.random() * charPool.length)]);
        }

        // Shuffle
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }

        const password = result.join('');
        pwDisplay.value = password;

        const strength = calculateStrength(password);
        strengthBar.style.width = `${strength.percent}%`;
        strengthBar.style.backgroundColor = strength.color;
        strengthText.textContent = strength.text;
        strengthText.style.color = strength.color;
    }

    pwModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            pwModeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPwMode = btn.dataset.mode;
            generatePassword();
        });
    });

    if (optExcludeAmbiguous) {
        optExcludeAmbiguous.addEventListener('change', generatePassword);
    }

    if (pwLengthSlider) {
        pwLengthSlider.addEventListener('input', () => {
            pwLengthVal.textContent = pwLengthSlider.value;
            generatePassword();
        });
    }

    [optUpper, optLower, optNumbers, optSymbols].forEach(checkbox => {
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                const anyChecked = optUpper.checked || optLower.checked || optNumbers.checked || optSymbols.checked;
                if (!anyChecked) {
                    checkbox.checked = true;
                    showToast('At least one character set required', 'fa-info-circle');
                }
                generatePassword();
            });
        }
    });

    if (pwRegenBtn) pwRegenBtn.addEventListener('click', generatePassword);
    if (pwCopyBtn) {
        pwCopyBtn.addEventListener('click', () => {
            copyToClipboard(pwDisplay.value, 'Password Copied');
        });
    }

    // =========================================================================
    // 5. Text Converter Module
    // =========================================================================
    const textInput = document.getElementById('tcInput');
    const textOutput = document.getElementById('tcOutput');
    const tcCopyBtn = document.getElementById('tcCopy');
    const tcClearBtn = document.getElementById('tcClear');
    const tcInputCount = document.getElementById('tcInputCount');
    const tcOutputCount = document.getElementById('tcOutputCount');
    const transformBtns = document.querySelectorAll('.ios-pill-btn');

    let currentTransformation = null;

    function getWords(text) {
        return text.trim().split(/[\s_\-]+/).filter(w => w.length > 0);
    }

    function applyTextTransform(text, type) {
        if (!text) return '';
        switch (type) {
            case 'uppercase':
                return text.toUpperCase();
            case 'lowercase':
                return text.toLowerCase();
            case 'capitalize':
                return text.toLowerCase().replace(/(^|[^\w'])([\w])/g, (m, p1, p2) => p1 + p2.toUpperCase());
            case 'sentence':
                return text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
            case 'hyphen':
                return text.trim().split(/\s+/).join('-');
            case 'underscore':
                return text.trim().split(/\s+/).join('_');
            case 'removeSpaces':
                return text.replace(/\s+/g, '');
            case 'reverse':
                return text.split('').reverse().join('');
            case 'camelCase': {
                const words = getWords(text);
                return words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
            }
            case 'pascalCase': {
                const words = getWords(text);
                return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
            }
            case 'snakeCase': {
                const words = getWords(text);
                return words.map(w => w.toLowerCase()).join('_');
            }
            case 'kebabCase': {
                const words = getWords(text);
                return words.map(w => w.toLowerCase()).join('-');
            }
            case 'constantCase': {
                const words = getWords(text);
                return words.map(w => w.toUpperCase()).join('_');
            }
            case 'slugify': {
                return text.toLowerCase().trim()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/[\s_-]+/g, '-')
                    .replace(/^-+|-+$/g, '');
            }
            case 'sortAsc': {
                return text.split('\n').sort((a, b) => a.localeCompare(b)).join('\n');
            }
            case 'sortDesc': {
                return text.split('\n').sort((a, b) => b.localeCompare(a)).join('\n');
            }
            case 'uniqueLines': {
                const seen = new Set();
                return text.split('\n').filter(line => {
                    if (seen.has(line)) return false;
                    seen.add(line);
                    return true;
                }).join('\n');
            }
            case 'trimLines': {
                return text.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
            }
            default:
                return text;
        }
    }

    function updateTextConverter() {
        const input = textInput.value;
        const words = input.trim() ? input.trim().split(/\s+/).length : 0;
        const readTime = Math.max(1, Math.ceil(words / 200));
        tcInputCount.textContent = `${input.length} chars • ${words} words • ~${readTime}m read`;

        const transformed = currentTransformation ? applyTextTransform(input, currentTransformation) : input;
        textOutput.value = transformed;
        tcOutputCount.textContent = `${transformed.length} chars`;
    }

    if (textInput) {
        textInput.addEventListener('input', updateTextConverter);
    }

    transformBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            transformBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTransformation = btn.dataset.transform;
            updateTextConverter();
        });
    });

    if (tcClearBtn) {
        tcClearBtn.addEventListener('click', () => {
            textInput.value = '';
            currentTransformation = null;
            transformBtns.forEach(b => b.classList.remove('active'));
            updateTextConverter();
            textInput.focus();
        });
    }

    if (tcCopyBtn) {
        tcCopyBtn.addEventListener('click', () => {
            copyToClipboard(textOutput.value, 'Text Copied');
        });
    }

    // =========================================================================
    // 6. Bullet Formatter Module
    // =========================================================================
    const bulletDropdown = document.getElementById('bfDropdown');
    const bulletInput = document.getElementById('bfInput');
    const bulletOutput = document.getElementById('bfOutput');
    const bfCopyBtn = document.getElementById('bfCopy');
    const bfClearBtn = document.getElementById('bfClear');
    const bfIndent = document.getElementById('bfIndent');
    const bfIndentSpaces = document.getElementById('bfIndentSpaces');
    const bfIndentRow = document.getElementById('bfIndentRow');
    const bfCustomRow = document.getElementById('bfCustomRow');
    const bfCustomPrefix = document.getElementById('bfCustomPrefix');

    function toAlpha(num, uppercase = true) {
        let str = '';
        while (num > 0) {
            const mod = (num - 1) % 26;
            str = String.fromCharCode((uppercase ? 65 : 97) + mod) + str;
            num = Math.floor((num - 1) / 26);
        }
        return str;
    }

    function toRoman(num, uppercase = true) {
        const romanMap = [
            { val: 1000, sym: 'M' },
            { val: 900, sym: 'CM' },
            { val: 500, sym: 'D' },
            { val: 400, sym: 'CD' },
            { val: 100, sym: 'C' },
            { val: 90, sym: 'XC' },
            { val: 50, sym: 'L' },
            { val: 40, sym: 'XL' },
            { val: 10, sym: 'X' },
            { val: 9, sym: 'IX' },
            { val: 5, sym: 'V' },
            { val: 4, sym: 'IV' },
            { val: 1, sym: 'I' }
        ];
        let roman = '';
        for (const { val, sym } of romanMap) {
            while (num >= val) {
                roman += sym;
                num -= val;
            }
        }
        return uppercase ? (roman || 'I') : (roman.toLowerCase() || 'i');
    }

    function updateBulletFormatter() {
        const text = bulletInput.value;
        const rawBullet = bulletDropdown.value;

        if (bfCustomRow) {
            bfCustomRow.style.display = rawBullet === 'custom' ? 'flex' : 'none';
        }

        const bullet = rawBullet === 'custom' ? (bfCustomPrefix ? bfCustomPrefix.value || '• ' : '• ') : rawBullet;
        const isIndent = bfIndent ? bfIndent.checked : false;
        const spaceCount = bfIndentSpaces ? Math.max(0, parseInt(bfIndentSpaces.value, 10) || 0) : 2;
        const indentPrefix = isIndent ? ' '.repeat(spaceCount) : '';

        const lines = text.split('\n').filter(line => line.trim() !== '');

        if (lines.length === 0) {
            bulletOutput.value = '';
            return;
        }

        let formattedLines = [];

        lines.forEach((line, idx) => {
            const trimmed = line.trim();

            // When Indent is enabled, Line 1 is kept as a header (skipped from bullets & indentation)
            if (isIndent && idx === 0) {
                formattedLines.push(trimmed);
                return;
            }

            // If indent is on, list numbering starts from 1 at Line 2 (idx 1 -> num 1)
            const num = isIndent ? idx : idx + 1;

            if (bullet === '123' || bullet === '1.') {
                formattedLines.push(`${indentPrefix}${num}. ${trimmed}`);
            } else if (bullet === 'abc') {
                formattedLines.push(`${indentPrefix}${toAlpha(num, false)}. ${trimmed}`);
            } else if (bullet === 'ABC') {
                formattedLines.push(`${indentPrefix}${toAlpha(num, true)}. ${trimmed}`);
            } else if (bullet === 'roman_upper' || bullet === 'roman') {
                formattedLines.push(`${indentPrefix}${toRoman(num, true)}. ${trimmed}`);
            } else if (bullet === 'roman_lower') {
                formattedLines.push(`${indentPrefix}${toRoman(num, false)}. ${trimmed}`);
            } else if (bullet.endsWith(' ')) {
                formattedLines.push(`${indentPrefix}${bullet}${trimmed}`);
            } else {
                formattedLines.push(`${indentPrefix}${bullet} ${trimmed}`);
            }
        });

        bulletOutput.value = formattedLines.join('\n');
    }

    if (bfCustomPrefix) bfCustomPrefix.addEventListener('input', updateBulletFormatter);

    if (bulletInput) bulletInput.addEventListener('input', updateBulletFormatter);
    if (bulletDropdown) bulletDropdown.addEventListener('change', updateBulletFormatter);

    if (bfIndent) {
        bfIndent.addEventListener('change', () => {
            if (bfIndentRow) {
                bfIndentRow.style.opacity = bfIndent.checked ? '1' : '0.5';
            }
            updateBulletFormatter();
        });
    }

    if (bfIndentSpaces) {
        bfIndentSpaces.addEventListener('input', updateBulletFormatter);
    }

    if (bfClearBtn) {
        bfClearBtn.addEventListener('click', () => {
            bulletInput.value = '';
            bulletOutput.value = '';
            bulletInput.focus();
        });
    }

    if (bfCopyBtn) {
        bfCopyBtn.addEventListener('click', () => {
            copyToClipboard(bulletOutput.value, 'List Copied');
        });
    }

    // =========================================================================
    // 7. Phone Formatter Module
    // =========================================================================
    const phoneInput = document.getElementById('phoneInput');
    const phoneOutput = document.getElementById('phoneOutput');
    const phoneCopyBtn = document.getElementById('phoneCopy');
    const phoneClearBtn = document.getElementById('phoneClear');
    const phoneDigitsInfo = document.getElementById('phoneDigitsInfo');
    const phoneTypeBtns = document.querySelectorAll('.phone-type-btn');

    let phoneFormatStyle = 'spaces';

    function formatPhone() {
        const raw = phoneInput.value;
        const cleaned = raw.replace(/\D/g, '').slice(0, 10);
        const len = cleaned.length;

        if (phoneInput.value !== cleaned) {
            phoneInput.value = cleaned;
        }

        phoneDigitsInfo.textContent = `${len}/10 digits`;

        if (len === 0) {
            phoneOutput.value = '';
            return;
        }

        let formatted = cleaned;

        if (phoneFormatStyle === 'spaces') {
            // 123 456 7890
            if (len <= 3) {
                formatted = cleaned;
            } else if (len <= 6) {
                formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
            } else {
                formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
            }
        } else if (phoneFormatStyle === 'hyphens') {
            // 123-456-7890
            if (len <= 3) {
                formatted = cleaned;
            } else if (len <= 6) {
                formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
            } else {
                formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
            }
        } else if (phoneFormatStyle === 'parentheses') {
            // (123) 456-7890
            if (len <= 3) {
                formatted = `(${cleaned}`;
            } else if (len <= 6) {
                formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
            } else {
                formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
            }
        }

        phoneOutput.value = formatted;
    }

    if (phoneInput) phoneInput.addEventListener('input', formatPhone);

    phoneTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            phoneTypeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            phoneFormatStyle = btn.dataset.format;
            formatPhone();
        });
    });

    const phoneWhatsappBtn = document.getElementById('phoneWhatsappBtn');
    if (phoneWhatsappBtn) {
        phoneWhatsappBtn.addEventListener('click', () => {
            const digits = phoneInput.value.replace(/\D/g, '');
            if (!digits) {
                showToast('Enter phone number first', 'fa-exclamation-circle');
                return;
            }
            const waLink = `https://wa.me/${digits}`;
            copyToClipboard(waLink, 'WhatsApp Link Copied!');
        });
    }

    if (phoneClearBtn) {
        phoneClearBtn.addEventListener('click', () => {
            phoneInput.value = '';
            phoneOutput.value = '';
            phoneDigitsInfo.textContent = '0/10 digits';
            phoneInput.focus();
        });
    }

    if (phoneCopyBtn) {
        phoneCopyBtn.addEventListener('click', () => {
            copyToClipboard(phoneOutput.value, 'Phone Number Copied');
        });
    }

    // =========================================================================
    // 7. QR Code Generator Module
    // =========================================================================
    const qrInput = document.getElementById('qrInput');
    const qrInputCount = document.getElementById('qrInputCount');
    const qrClearBtn = document.getElementById('qrClear');
    const qrSizeSelect = document.getElementById('qrSizeSelect');
    const qrLevelSelect = document.getElementById('qrLevelSelect');
    const qrCanvasWrapper = document.getElementById('qrCanvasWrapper');
    const qrCopyBtn = document.getElementById('qrCopyBtn');
    const qrDownloadBtn = document.getElementById('qrDownloadBtn');

    const qrTplUrl = document.getElementById('qrTplUrl');
    const qrTplWifi = document.getElementById('qrTplWifi');
    const qrTplText = document.getElementById('qrTplText');

    let qrCodeInstance = null;

    function renderQRCode() {
        if (!qrCanvasWrapper) return;
        const text = qrInput ? qrInput.value.trim() : '';

        if (qrInputCount && qrInput) {
            qrInputCount.textContent = `${qrInput.value.length} chars`;
        }

        if (!text) {
            qrCanvasWrapper.innerHTML = '<span style="color: #8e8e93; font-size: 13px;">Type or paste text above to generate QR code</span>';
            qrCodeInstance = null;
            return;
        }

        const size = parseInt(qrSizeSelect.value, 10) || 220;
        const levelKey = qrLevelSelect.value || 'H';
        const level = (window.QRCode && QRCode.CorrectLevel) ? (QRCode.CorrectLevel[levelKey] || QRCode.CorrectLevel.H) : 2;

        qrCanvasWrapper.innerHTML = '';
        try {
            qrCodeInstance = new QRCode(qrCanvasWrapper, {
                text: text,
                width: size,
                height: size,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: level
            });

            // Ensure only one visual element (img) is shown and canvas stays hidden
            const syncDisplay = () => {
                const canvas = qrCanvasWrapper.querySelector('canvas');
                const img = qrCanvasWrapper.querySelector('img');
                if (canvas && img && img.src && img.src.length > 50) {
                    canvas.style.display = 'none';
                    img.style.display = 'block';
                }
            };
            setTimeout(syncDisplay, 20);
            setTimeout(syncDisplay, 100);
        } catch (err) {
            qrCanvasWrapper.innerHTML = `<span style="color: var(--ios-red); font-size: 13px;">QR Error: ${err.message}</span>`;
        }
    }

    if (qrInput) {
        qrInput.addEventListener('input', renderQRCode);
    }

    if (qrSizeSelect) {
        qrSizeSelect.addEventListener('change', renderQRCode);
    }

    if (qrLevelSelect) {
        qrLevelSelect.addEventListener('change', renderQRCode);
    }

    if (qrClearBtn) {
        qrClearBtn.addEventListener('click', () => {
            if (qrInput) {
                qrInput.value = '';
                renderQRCode();
                qrInput.focus();
            }
        });
    }

    if (qrTplUrl) {
        qrTplUrl.addEventListener('click', () => {
            qrInput.value = 'https://apple.com';
            renderQRCode();
            showToast('URL Template Applied');
        });
    }

    if (qrTplWifi) {
        qrTplWifi.addEventListener('click', () => {
            qrInput.value = 'WIFI:S:MyNetworkName;T:WPA;P:MyPassword123;;';
            renderQRCode();
            showToast('Wi-Fi Template Applied');
        });
    }

    if (qrTplText) {
        qrTplText.addEventListener('click', () => {
            qrInput.value = 'Meeting scheduled for tomorrow at 10:00 AM in Room 402.';
            renderQRCode();
            showToast('Note Template Applied');
        });
    }

    if (qrDownloadBtn) {
        qrDownloadBtn.addEventListener('click', () => {
            if (!qrCanvasWrapper) return;
            const canvas = qrCanvasWrapper.querySelector('canvas');
            const img = qrCanvasWrapper.querySelector('img');

            if (!canvas && !img) {
                showToast('No QR code to download', 'fa-exclamation-circle');
                return;
            }

            const dataUrl = canvas ? canvas.toDataURL('image/png') : img.src;
            const a = document.createElement('a');
            a.download = 'assistant-qr.png';
            a.href = dataUrl;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast('QR Code Downloaded');
        });
    }

    if (qrCopyBtn) {
        qrCopyBtn.addEventListener('click', () => {
            if (!qrCanvasWrapper) return;
            const canvas = qrCanvasWrapper.querySelector('canvas');

            if (!canvas) {
                showToast('Unable to copy QR image', 'fa-exclamation-circle');
                return;
            }

            if (navigator.clipboard && window.ClipboardItem && canvas.toBlob) {
                canvas.toBlob(blob => {
                    if (!blob) {
                        showToast('Failed to generate image', 'fa-times-circle');
                        return;
                    }
                    navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]).then(() => {
                        showToast('QR Image Copied!');
                    }).catch(() => {
                        showToast('Copy image not supported by browser', 'fa-exclamation-circle');
                    });
                });
            } else {
                showToast('Clipboard image copy not supported', 'fa-exclamation-circle');
            }
        });
    }

    // =========================================================================
    // 8. Developer Tools (JSON & Encoders) Module
    // =========================================================================
    const devInput = document.getElementById('devInput');
    const devInputCount = document.getElementById('devInputCount');
    const devOutput = document.getElementById('devOutput');
    const devOutputCount = document.getElementById('devOutputCount');
    const devClearBtn = document.getElementById('devClear');
    const devSampleBtn = document.getElementById('devSampleBtn');
    const devCopyBtn = document.getElementById('devCopyBtn');
    const devStatus = document.getElementById('devStatus');
    const devStatusText = document.getElementById('devStatusText');
    const devStatusMeta = document.getElementById('devStatusMeta');
    const devActionBtns = document.querySelectorAll('.dev-action-btn');

    function updateDevCounts() {
        if (devInput && devInputCount) {
            devInputCount.textContent = `${devInput.value.length} chars`;
        }
        if (devOutput && devOutputCount) {
            devOutputCount.textContent = `${devOutput.value.length} chars`;
        }
    }

    function inspectDevInput() {
        updateDevCounts();
        if (!devInput || !devStatus) return;

        const val = devInput.value.trim();
        if (!val) {
            devStatus.className = 'dev-status-bar idle';
            devStatusText.innerHTML = '<i class="fas fa-circle-info"></i> Ready for transformation';
            devStatusMeta.textContent = '';
            return;
        }

        // If it looks like JSON
        if (val.startsWith('{') || val.startsWith('[')) {
            try {
                const parsed = JSON.parse(val);
                const keysCount = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 1;
                devStatus.className = 'dev-status-bar valid';
                devStatusText.innerHTML = '<i class="fas fa-check-circle"></i> Valid JSON Syntax';
                devStatusMeta.textContent = `${keysCount} root keys • ${new Blob([val]).size} bytes`;
            } catch (err) {
                devStatus.className = 'dev-status-bar invalid';
                devStatusText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Invalid JSON Syntax';
                devStatusMeta.textContent = err.message.replace(/^JSON\.parse:\s*/, '');
            }
        } else {
            devStatus.className = 'dev-status-bar idle';
            devStatusText.innerHTML = '<i class="fas fa-circle-info"></i> Ready for transformation';
            devStatusMeta.textContent = `${val.length} chars`;
        }
    }

    if (devInput) {
        devInput.addEventListener('input', inspectDevInput);
    }

    if (devClearBtn) {
        devClearBtn.addEventListener('click', () => {
            if (devInput) devInput.value = '';
            if (devOutput) devOutput.value = '';
            inspectDevInput();
            devInput.focus();
        });
    }

    if (devSampleBtn) {
        devSampleBtn.addEventListener('click', () => {
            const sample = {
                app: "Assistant",
                version: "2.0.0",
                features: ["Password", "Text", "Bullets", "Phone", "QR Code", "Dev Tools"],
                clientSideOnly: true,
                settings: {
                    theme: "dark",
                    performance: "instant"
                }
            };
            devInput.value = JSON.stringify(sample);
            inspectDevInput();
            showToast('Sample JSON Loaded');
        });
    }

    // Developer actions dispatcher
    devActionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const inputVal = devInput ? devInput.value : '';

            if (!inputVal.trim()) {
                showToast('Please enter text first', 'fa-exclamation-circle');
                return;
            }

            try {
                switch (action) {
                    case 'json-format-2': {
                        const parsed = JSON.parse(inputVal);
                        devOutput.value = JSON.stringify(parsed, null, 2);
                        showToast('JSON Formatted (2 Spaces)');
                        break;
                    }
                    case 'json-format-4': {
                        const parsed = JSON.parse(inputVal);
                        devOutput.value = JSON.stringify(parsed, null, 4);
                        showToast('JSON Formatted (4 Spaces)');
                        break;
                    }
                    case 'json-minify': {
                        const parsed = JSON.parse(inputVal);
                        devOutput.value = JSON.stringify(parsed);
                        showToast('JSON Minified');
                        break;
                    }
                    case 'json-validate': {
                        JSON.parse(inputVal);
                        showToast('JSON is 100% Valid!', 'fa-check-circle');
                        break;
                    }
                    case 'b64-encode': {
                        // Safe UTF-8 Base64 encode
                        const b64 = btoa(encodeURIComponent(inputVal).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
                        devOutput.value = b64;
                        showToast('Base64 Encoded');
                        break;
                    }
                    case 'b64-decode': {
                        // Safe UTF-8 Base64 decode
                        const cleanStr = inputVal.trim();
                        const decoded = decodeURIComponent(atob(cleanStr).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                        devOutput.value = decoded;
                        showToast('Base64 Decoded');
                        break;
                    }
                    case 'url-encode': {
                        devOutput.value = encodeURIComponent(inputVal);
                        showToast('URL Encoded');
                        break;
                    }
                    case 'url-decode': {
                        devOutput.value = decodeURIComponent(inputVal);
                        showToast('URL Decoded');
                        break;
                    }
                    case 'html-escape': {
                        devOutput.value = inputVal
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#039;');
                        showToast('HTML Escaped');
                        break;
                    }
                    case 'html-unescape': {
                        const parser = new DOMParser();
                        const dom = parser.parseFromString(inputVal, 'text/html');
                        devOutput.value = dom.documentElement.textContent;
                        showToast('HTML Unescaped');
                        break;
                    }
                }
            } catch (err) {
                showToast(err.message, 'fa-exclamation-triangle');
            }

            updateDevCounts();
        });
    });

    if (devCopyBtn) {
        devCopyBtn.addEventListener('click', () => {
            copyToClipboard(devOutput ? devOutput.value : '', 'Result Copied');
        });
    }

    // =========================================================================
    // 9. Timestamp & Date Tools Module
    // =========================================================================
    const liveEpochDisplay = document.getElementById('liveEpochDisplay');
    const copyLiveEpoch = document.getElementById('copyLiveEpoch');
    const epochInput = document.getElementById('epochInput');
    const epochSetNowBtn = document.getElementById('epochSetNowBtn');
    const epochLocalRes = document.getElementById('epochLocalRes');
    const epochUtcRes = document.getElementById('epochUtcRes');
    const epochRelativeRes = document.getElementById('epochRelativeRes');
    const copyLocalTimeBtn = document.getElementById('copyLocalTimeBtn');
    const copyUtcTimeBtn = document.getElementById('copyUtcTimeBtn');

    const datePickerInput = document.getElementById('datePickerInput');
    const dateToEpochSec = document.getElementById('dateToEpochSec');
    const dateToEpochMs = document.getElementById('dateToEpochMs');
    const copyEpochSecBtn = document.getElementById('copyEpochSecBtn');
    const copyEpochMsBtn = document.getElementById('copyEpochMsBtn');

    function updateLiveTicker() {
        if (!liveEpochDisplay) return;
        const nowSec = Math.floor(Date.now() / 1000);
        liveEpochDisplay.value = `${nowSec} (${new Date().toLocaleTimeString()})`;
    }
    setInterval(updateLiveTicker, 1000);
    updateLiveTicker();

    if (copyLiveEpoch) {
        copyLiveEpoch.addEventListener('click', () => {
            const nowSec = Math.floor(Date.now() / 1000).toString();
            copyToClipboard(nowSec, 'Current Timestamp Copied');
        });
    }

    function formatRelativeTime(date) {
        const delta = Math.round((date.getTime() - Date.now()) / 1000);
        if (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
            const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
            const abs = Math.abs(delta);
            if (abs < 60) return rtf.format(delta, 'second');
            if (abs < 3600) return rtf.format(Math.round(delta / 60), 'minute');
            if (abs < 86400) return rtf.format(Math.round(delta / 3600), 'hour');
            return rtf.format(Math.round(delta / 86400), 'day');
        }
        return delta >= 0 ? `in ${Math.abs(delta)}s` : `${Math.abs(delta)}s ago`;
    }

    function convertEpoch() {
        if (!epochInput) return;
        let val = epochInput.value.trim();
        if (!val) {
            epochLocalRes.textContent = '-';
            epochUtcRes.textContent = '-';
            epochRelativeRes.textContent = '-';
            return;
        }
        let num = parseInt(val, 10);
        const date = num > 1e11 ? new Date(num) : new Date(num * 1000);
        if (isNaN(date.getTime())) {
            epochLocalRes.textContent = 'Invalid timestamp';
            epochUtcRes.textContent = 'Invalid timestamp';
            epochRelativeRes.textContent = '-';
            return;
        }
        epochLocalRes.textContent = date.toLocaleString();
        epochUtcRes.textContent = date.toISOString();
        epochRelativeRes.textContent = formatRelativeTime(date);
    }

    if (epochInput) epochInput.addEventListener('input', convertEpoch);
    if (epochSetNowBtn) {
        epochSetNowBtn.addEventListener('click', () => {
            epochInput.value = Math.floor(Date.now() / 1000);
            convertEpoch();
            showToast('Set to Current Time');
        });
    }

    if (copyLocalTimeBtn) copyLocalTimeBtn.addEventListener('click', () => copyToClipboard(epochLocalRes.textContent, 'Local Time Copied'));
    if (copyUtcTimeBtn) copyUtcTimeBtn.addEventListener('click', () => copyToClipboard(epochUtcRes.textContent, 'UTC / ISO Copied'));

    function convertDatePicker() {
        if (!datePickerInput || !datePickerInput.value) return;
        const d = new Date(datePickerInput.value);
        if (isNaN(d.getTime())) return;
        const ms = d.getTime();
        const sec = Math.floor(ms / 1000);
        dateToEpochSec.textContent = sec.toString();
        dateToEpochMs.textContent = ms.toString();
    }

    if (datePickerInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        datePickerInput.value = now.toISOString().slice(0, 16);
        datePickerInput.addEventListener('input', convertDatePicker);
        convertDatePicker();
    }

    if (copyEpochSecBtn) copyEpochSecBtn.addEventListener('click', () => copyToClipboard(dateToEpochSec.textContent, 'Epoch Seconds Copied'));
    if (copyEpochMsBtn) copyEpochMsBtn.addEventListener('click', () => copyToClipboard(dateToEpochMs.textContent, 'Epoch Milliseconds Copied'));

    // =========================================================================
    // 10. Color Studio & Contrast Checker Module
    // =========================================================================
    const colorPickerInput = document.getElementById('colorPickerInput');
    const colorHexInput = document.getElementById('colorHexInput');
    const colorPreviewBox = document.getElementById('colorPreviewBox');
    const colorPreviewText = document.getElementById('colorPreviewText');
    const colorHexVal = document.getElementById('colorHexVal');
    const colorRgbVal = document.getElementById('colorRgbVal');
    const colorHslVal = document.getElementById('colorHslVal');
    const copyHexBtn = document.getElementById('copyHexBtn');
    const copyRgbBtn = document.getElementById('copyRgbBtn');
    const copyHslBtn = document.getElementById('copyHslBtn');
    const colorSwatchesRow = document.getElementById('colorSwatchesRow');

    const contrastWhiteRatio = document.getElementById('contrastWhiteRatio');
    const contrastBlackRatio = document.getElementById('contrastBlackRatio');
    const contrastWhiteBadge = document.getElementById('contrastWhiteBadge');
    const contrastBlackBadge = document.getElementById('contrastBlackBadge');

    function hexToRgb(hex) {
        let clean = hex.replace('#', '');
        if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
        const num = parseInt(clean, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    function getLuminance(r, g, b) {
        const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function updateColorStudio(hex) {
        if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) return;
        let fullHex = hex.toUpperCase();
        if (fullHex.length === 4) {
            fullHex = '#' + fullHex[1] + fullHex[1] + fullHex[2] + fullHex[2] + fullHex[3] + fullHex[3];
        }

        if (colorPickerInput) colorPickerInput.value = fullHex;
        if (colorHexInput && colorHexInput.value.toUpperCase() !== fullHex) colorHexInput.value = fullHex;

        const { r, g, b } = hexToRgb(fullHex);
        const { h, s, l } = rgbToHsl(r, g, b);

        const rgbStr = `rgb(${r}, ${g}, ${b})`;
        const hslStr = `hsl(${h}, ${s}%, ${l}%)`;

        if (colorPreviewBox) colorPreviewBox.style.backgroundColor = fullHex;
        if (colorHexVal) colorHexVal.textContent = fullHex;
        if (colorRgbVal) colorRgbVal.textContent = rgbStr;
        if (colorHslVal) colorHslVal.textContent = hslStr;

        // WCAG Luminance & Contrast
        const lum = getLuminance(r, g, b);
        const ratioWhite = (1.05 / (lum + 0.05));
        const ratioBlack = ((lum + 0.05) / 0.05);

        if (colorPreviewText) {
            colorPreviewText.textContent = fullHex;
            colorPreviewText.style.color = ratioWhite >= ratioBlack ? '#ffffff' : '#000000';
        }

        if (contrastWhiteRatio) contrastWhiteRatio.textContent = `${ratioWhite.toFixed(2)}:1`;
        if (contrastBlackRatio) contrastBlackRatio.textContent = `${ratioBlack.toFixed(2)}:1`;

        if (contrastWhiteBadge) {
            const pass = ratioWhite >= 4.5;
            contrastWhiteBadge.textContent = pass ? 'AA PASS' : 'FAIL';
            contrastWhiteBadge.className = `contrast-badge ${pass ? 'pass' : 'fail'}`;
        }
        if (contrastBlackBadge) {
            const pass = ratioBlack >= 4.5;
            contrastBlackBadge.textContent = pass ? 'AA PASS' : 'FAIL';
            contrastBlackBadge.className = `contrast-badge ${pass ? 'pass' : 'fail'}`;
        }

        // Palette Swatches (Lighter & Darker variations)
        if (colorSwatchesRow) {
            const variations = [-30, -15, 0, 15, 30].map(dl => {
                const newL = Math.max(8, Math.min(92, l + dl));
                return `hsl(${h}, ${s}%, ${newL}%)`;
            });
            colorSwatchesRow.innerHTML = variations.map(col => `
                <div class="color-swatch" style="background-color: ${col};" title="${col}"></div>
            `).join('');

            colorSwatchesRow.querySelectorAll('.color-swatch').forEach(swatch => {
                swatch.addEventListener('click', () => {
                    const bg = swatch.title;
                    copyToClipboard(bg, `${bg} Copied`);
                });
            });
        }
    }

    if (colorPickerInput) {
        colorPickerInput.addEventListener('input', () => updateColorStudio(colorPickerInput.value));
    }
    if (colorHexInput) {
        colorHexInput.addEventListener('input', () => {
            let val = colorHexInput.value.trim();
            if (!val.startsWith('#')) val = '#' + val;
            updateColorStudio(val);
        });
    }

    if (copyHexBtn) copyHexBtn.addEventListener('click', () => copyToClipboard(colorHexVal.textContent, 'HEX Copied'));
    if (copyRgbBtn) copyRgbBtn.addEventListener('click', () => copyToClipboard(colorRgbVal.textContent, 'RGB Copied'));
    if (copyHslBtn) copyHslBtn.addEventListener('click', () => copyToClipboard(colorHslVal.textContent, 'HSL Copied'));

    // =========================================================================
    // 11. Recent Clipboard History Drawer
    // =========================================================================
    const historyToggleBtn = document.getElementById('historyToggleBtn');
    const historyList = document.getElementById('historyList');
    const historyCount = document.getElementById('historyCount');
    const historyChevron = document.getElementById('historyChevron');

    let copyHistory = [];
    try {
        const stored = localStorage.getItem('assistant_history');
        if (stored) copyHistory = JSON.parse(stored);
    } catch (e) {}

    function saveHistory() {
        try {
            localStorage.setItem('assistant_history', JSON.stringify(copyHistory.slice(0, 5)));
        } catch (e) {}
        renderHistory();
    }

    function addToHistory(text) {
        if (!text || text.trim() === '') return;
        const clean = text.trim();
        copyHistory = [clean, ...copyHistory.filter(item => item !== clean)].slice(0, 5);
        saveHistory();
    }

    function renderHistory() {
        if (historyCount) historyCount.textContent = copyHistory.length;
        if (!historyList) return;
        if (copyHistory.length === 0) {
            historyList.innerHTML = '<div style="color: #636366; font-size: 13px; text-align: center; padding: 12px;">No recent copies yet</div>';
            return;
        }
        historyList.innerHTML = copyHistory.map((item, idx) => `
            <div class="history-item-card">
                <span class="history-item-text">${item.replace(/</g, '&lt;')}</span>
                <div style="display: flex; gap: 8px;">
                    <button class="ios-link-btn history-copy-btn" data-index="${idx}">Copy</button>
                    <button class="ios-link-btn destructive history-del-btn" data-index="${idx}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');

        historyList.querySelectorAll('.history-copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                copyToClipboard(copyHistory[idx], 'Copied from History');
            });
        });

        historyList.querySelectorAll('.history-del-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                copyHistory.splice(idx, 1);
                saveHistory();
            });
        });
    }

    if (historyToggleBtn && historyList) {
        historyToggleBtn.addEventListener('click', () => {
            const isShown = historyList.classList.toggle('show');
            if (historyChevron) {
                historyChevron.style.transform = isShown ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        });
    }

    // =========================================================================
    // Initial Setup
    // =========================================================================
    initTabFromHash();
    generatePassword();
    renderQRCode();
    inspectDevInput();
    updateColorStudio('#0A84FF');
    renderHistory();
});
