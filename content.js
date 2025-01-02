class ElementManager {
  constructor() {
    this.isActive = false;
    this.currentMode = 'single';
    this.selectedElements = new Set();
    this.removedElements = new Map();
    this.redoStack = new Map();
    this.savedRules = new Map();
    
    // 支援的語言列表
    this.supportedLanguages = {
      'en': 'English',
      'zh': '中文',
      'ja': '日本語',
      'ko': '한국어',
      'ru': 'Русский',
      'es': 'Español'
    };
    
    // 多語言支援
    this.currentLang = this.loadLanguagePreference() || navigator.language.toLowerCase().split('-')[0] || 'en';
    this.i18n = {};
    
    // 設定
    this.settings = {
      autoHide: false,
      smartSelect: false,
      language: this.currentLang
    };
    
    this.floatingMenu = null;
    this.isMenuVisible = false;
  }

  async init() {
    await this.loadLanguages();
    this.setupEventListeners();
    this.loadSavedRules();
    if (this.settings.autoApplyRules) {
      this.applyRules();
    }
  }

  async loadLanguages() {
    try {
      const response = await fetch(chrome.runtime.getURL('languages.json'));
      this.i18n = await response.json();
    } catch (error) {
      console.error('Error loading languages:', error);
      // 如果加載失敗，使用英文作為備用
      this.currentLang = 'en';
    }
  }

  loadLanguagePreference() {
    const lang = localStorage.getItem('elementRemoverLanguage');
    return lang && this.supportedLanguages[lang] ? lang : null;
  }

  saveLanguagePreference(lang) {
    localStorage.setItem('elementRemoverLanguage', lang);
    this.currentLang = lang;
    this.settings.language = lang;
    this.saveSettings();
    this.updateMenuLanguage();
  }

  updateMenuLanguage() {
    if (!this.floatingMenu) return;
    
    // 更新所有文本內容
    this.floatingMenu.querySelector('.title').textContent = this.getText('title');
    this.floatingMenu.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.dataset.i18n;
      element.textContent = this.getText(key);
    });
  }

  createFloatingMenu() {
    const menu = document.createElement('div');
    menu.className = 'element-remover-menu';
    
    // 標題區域
    const header = document.createElement('div');
    header.className = 'element-remover-header';
    header.textContent = this.getText('menuTitle');
    
    const headerActions = document.createElement('div');
    headerActions.className = 'header-actions';
    
    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = '−';
    minimizeBtn.title = this.getText('minimize');
    minimizeBtn.onclick = () => this.toggleMenuMinimize();
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.title = this.getText('close');
    closeBtn.onclick = () => {
      this.deactivate();
      this.hideMenu();
    };
    
    headerActions.appendChild(minimizeBtn);
    headerActions.appendChild(closeBtn);
    header.appendChild(headerActions);
    
    const content = document.createElement('div');
    content.className = 'element-remover-content';
    
    // 結束刪除按鈕
    const stopSection = document.createElement('div');
    stopSection.className = 'stop-section';
    
    const stopButton = document.createElement('button');
    stopButton.className = 'stop-btn danger';
    stopButton.innerHTML = '⏹️ ' + this.getText('stopRemoving');
    stopButton.onclick = () => {
      this.deactivate();
      this.hideMenu();
      this.showNotification('notifications.removingStopped');
    };
    
    stopSection.appendChild(stopButton);
    content.appendChild(stopSection);
    
    // 模式選擇區段
    const modeSection = document.createElement('div');
    modeSection.className = 'mode-section';
    
    const modeTitle = document.createElement('h3');
    modeTitle.textContent = this.getText('selectMode');
    modeSection.appendChild(modeTitle);
    
    const modeButtons = document.createElement('div');
    modeButtons.className = 'mode-buttons';
    
    const modes = [
      { id: 'single', icon: '🎯', label: this.getText('singleMode') },
      { id: 'multi', icon: '✨', label: this.getText('multiMode') },
      { id: 'similar', icon: '🔍', label: this.getText('similarMode') }
    ];
    
    modes.forEach(mode => {
      const button = document.createElement('button');
      button.className = 'mode-btn';
      button.dataset.mode = mode.id;
      button.innerHTML = `${mode.icon} ${mode.label}`;
      button.onclick = () => this.setMode(mode.id);
      modeButtons.appendChild(button);
    });
    
    modeSection.appendChild(modeButtons);
    content.appendChild(modeSection);
    
    // 規則設置區段
    const rulesSection = document.createElement('div');
    rulesSection.className = 'rules-section';
    
    const rulesTitle = document.createElement('h3');
    rulesTitle.textContent = this.getText('rules');
    rulesSection.appendChild(rulesTitle);
    
    const autoHideLabel = document.createElement('label');
    autoHideLabel.className = 'switch-label';
    autoHideLabel.innerHTML = `
      <input type="checkbox" id="autoHide">
      <span>${this.getText('autoHide')}</span>
    `;
    
    const smartSelectLabel = document.createElement('label');
    smartSelectLabel.className = 'switch-label';
    smartSelectLabel.innerHTML = `
      <input type="checkbox" id="smartSelect">
      <span>${this.getText('smartSelect')}</span>
    `;
    
    rulesSection.appendChild(autoHideLabel);
    rulesSection.appendChild(smartSelectLabel);
    content.appendChild(rulesSection);
    
    // 歷史記錄區段
    const historySection = document.createElement('div');
    historySection.className = 'history-section';
    
    const historyTitle = document.createElement('h3');
    historyTitle.textContent = this.getText('history');
    historySection.appendChild(historyTitle);
    
    const historyActions = document.createElement('div');
    historyActions.className = 'history-actions';
    
    const undoBtn = document.createElement('button');
    undoBtn.className = 'history-btn';
    undoBtn.innerHTML = '↩️ ' + this.getText('undo');
    undoBtn.onclick = () => this.undo();
    
    const redoBtn = document.createElement('button');
    redoBtn.className = 'history-btn';
    redoBtn.innerHTML = '↪️ ' + this.getText('redo');
    redoBtn.onclick = () => this.redo();
    
    historyActions.appendChild(undoBtn);
    historyActions.appendChild(redoBtn);
    historySection.appendChild(historyActions);
    content.appendChild(historySection);
    
    // 語言設置區段
    const languageSection = document.createElement('div');
    languageSection.className = 'language-section';
    
    const languageTitle = document.createElement('h3');
    languageTitle.textContent = 'Language Settings';
    languageSection.appendChild(languageTitle);
    
    const languageSelect = document.createElement('select');
    languageSelect.className = 'language-select';
    
    Object.entries(this.supportedLanguages).forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      if (code === this.currentLang) {
        option.selected = true;
      }
      languageSelect.appendChild(option);
    });
    
    languageSelect.onchange = (e) => {
      this.saveLanguagePreference(e.target.value);
      this.updateMenuText();
    };
    
    languageSection.appendChild(languageSelect);
    content.appendChild(languageSection);
    
    menu.appendChild(header);
    menu.appendChild(content);
    document.body.appendChild(menu);
    
    this.makeDraggable(menu, header);
    this.setupMenuListeners();
    
    return menu;
  }

  setupMenuListeners() {
    const menu = this.floatingMenu;
    if (!menu) return;

    // 模式選擇按鈕
    menu.querySelectorAll('.mode-btn').forEach(btn => {
      btn.onclick = () => {
        menu.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setMode(btn.dataset.mode);
      };
    });

    // 規則設定
    const autoHideCheckbox = menu.querySelector('#autoHide');
    if (autoHideCheckbox) {
      autoHideCheckbox.checked = this.settings.autoHide;
      autoHideCheckbox.onchange = (e) => {
        this.settings.autoHide = e.target.checked;
        this.saveSettings();
      };
    }

    const smartSelectCheckbox = menu.querySelector('#smartSelect');
    if (smartSelectCheckbox) {
      smartSelectCheckbox.checked = this.settings.smartSelect;
      smartSelectCheckbox.onchange = (e) => {
        this.settings.smartSelect = e.target.checked;
        this.saveSettings();
      };
    }

    // 歷史操作按鈕
    const undoBtn = menu.querySelector('.history-actions button:first-child');
    if (undoBtn) {
      undoBtn.onclick = () => this.undo();
    }

    const redoBtn = menu.querySelector('.history-actions button:last-child');
    if (redoBtn) {
      redoBtn.onclick = () => this.redo();
    }

    // 語言選擇
    const languageSelect = menu.querySelector('.language-select');
    if (languageSelect) {
      languageSelect.value = this.currentLang;
      languageSelect.onchange = (e) => {
        this.saveLanguagePreference(e.target.value);
      };
    }

    // 停止按鈕
    const stopBtn = menu.querySelector('.stop-btn');
    if (stopBtn) {
      stopBtn.onclick = () => {
        this.deactivate();
        this.hideMenu();
        this.showNotification('notifications.removingStopped');
      };
    }
  }

  showMenu() {
    if (!this.floatingMenu) {
      this.floatingMenu = this.createFloatingMenu();
    }
    this.floatingMenu.style.display = 'block';
    this.isMenuVisible = true;
  }

  hideMenu() {
    if (this.floatingMenu) {
      this.floatingMenu.style.display = 'none';
      this.isMenuVisible = false;
    }
  }

  saveSettings() {
    chrome.storage.local.set({
      settings: this.settings
    });
  }

  loadSettings() {
    chrome.storage.local.get(['settings'], (result) => {
      if (result.settings) {
        this.settings = { ...this.settings, ...result.settings };
      }
    });
  }

  saveCurrentRules() {
    const rules = Array.from(this.removedElements.values()).map(info => ({
      selector: this.getElementSelector(info.element),
      type: info.element.tagName.toLowerCase(),
      path: this.getElementPath(info.element)
    }));

    chrome.storage.local.get(['siteRules'], (result) => {
      const allRules = result.siteRules || {};
      allRules[this.currentDomain] = rules;
      chrome.storage.local.set({ siteRules: allRules });
      this.showNotification('規則已保存');
    });
  }

  clearSiteRules() {
    chrome.storage.local.get(['siteRules'], (result) => {
      const allRules = result.siteRules || {};
      delete allRules[this.currentDomain];
      chrome.storage.local.set({ siteRules: allRules });
      this.showNotification('網站規則已清除');
    });
  }

  loadSavedRules() {
    chrome.storage.local.get(['siteRules'], (result) => {
      const rules = result.siteRules?.[this.currentDomain] || [];
      this.savedRules.set(this.currentDomain, rules);
    });
  }

  applyRules() {
    const rules = this.savedRules.get(this.currentDomain) || [];
    rules.forEach(rule => {
      const elements = document.querySelectorAll(rule.selector);
      elements.forEach(element => {
        if (this.isValidTarget(element)) {
          this.removeElements([element]);
        }
      });
    });
  }

  resetPage() {
    Array.from(this.removedElements.values()).forEach(info => {
      if (info.nextSibling) {
        info.parent.insertBefore(info.element, info.nextSibling);
      } else {
        info.parent.appendChild(info.element);
      }
    });
    this.removedElements.clear();
    this.showNotification('頁面已重設');
  }

  showNotification(messageKey, params = {}) {
    const message = this.getText(`messages.${messageKey}`, params);
    const notification = document.createElement('div');
    notification.className = 'element-remover-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  }

  setupDraggable(menu) {
    const header = menu.querySelector('.element-remover-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      initialX = e.clientX - menu.offsetLeft;
      initialY = e.clientY - menu.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      menu.style.left = `${currentX}px`;
      menu.style.top = `${currentY}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  setupEventListeners() {
    // 滑鼠移動事件
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    // 點擊事件
    document.addEventListener('click', this.handleClick.bind(this));
    // 按鍵事件
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  handleMouseMove(e) {
    if (!this.isActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;

    // 不處理選單相關元素
    if (this.floatingMenu && (this.floatingMenu === target || this.floatingMenu.contains(target))) {
      this.clearHighlight();
      return;
    }
    
    // 檢查是否為可刪除的元素
    if (!this.isValidTarget(target)) {
      this.clearHighlight();
      return;
    }
    
    // 移除之前的高亮
    this.clearHighlight();
    
    if (this.currentMode === 'similar') {
      // 尋找相似元素
      const similarElements = this.findSimilarElements(target);
      similarElements.forEach(element => {
        this.highlightElement(element);
      });
    } else {
      // 單一或多重選擇模式
      this.highlightElement(target);
    }
  }

  handleClick(e) {
    if (!this.isActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;
    
    // 檢查是否點擊到選單或其子元素
    if (this.floatingMenu && (this.floatingMenu === target || this.floatingMenu.contains(target))) {
      return;
    }

    // 檢查是否為可刪除的元素
    if (!this.isValidTarget(target)) {
      return;
    }
    
    if (this.currentMode === 'multi') {
      if (e.shiftKey) {
        // Shift + 點擊 = 刪除所有選中的元素
        const elements = Array.from(this.selectedElements);
        if (elements.length > 0) {
          this.removeElements(elements);
          this.selectedElements.clear();
          this.showNotification('deletedMultiple', { count: elements.length });
        }
      } else {
        // 一般點擊 = 選擇元素
        this.toggleElementSelection(target);
        // 顯示多重選擇模式的提示
        if (this.selectedElements.size === 1) {
          this.showNotification('multiSelectHint');
        }
      }
    } else if (this.currentMode === 'similar') {
      const similarElements = this.findSimilarElements(target);
      this.removeElements(similarElements);
      this.showNotification('deletedSimilar', { count: similarElements.length });
    } else {
      this.removeElements([target]);
      this.showNotification('deleted');
    }
  }

  handleKeyDown(e) {
    if (!this.isActive) return;
    
    if (e.key === 'Escape') {
      this.deactivate();
    } else if (e.key === 'z' && e.ctrlKey) {
      this.undo();
    } else if (e.key === 'y' && e.ctrlKey) {
      this.redo();
    }
  }

  toggleElementSelection(element) {
    if (!this.isValidTarget(element)) return;

    if (this.selectedElements.has(element)) {
      this.selectedElements.delete(element);
      element.classList.remove('element-remover-selected');
    } else {
      this.selectedElements.add(element);
      element.classList.add('element-remover-selected');
    }

    // 更新選中數量提示
    const count = this.selectedElements.size;
    if (count > 0) {
      this.showNotification('selectedCount', { count });
    }
  }

  removeElements(elements) {
    let validElements = elements.filter(element => this.isValidTarget(element));
    
    validElements.forEach(element => {
      // 克隆元素前先移除所有事件監聽器
      const clone = element.cloneNode(true);
      
      // 移除所有內聯事件處理器
      const allElements = [clone, ...clone.getElementsByTagName('*')];
      allElements.forEach(el => {
        const attrs = el.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
          const attrName = attrs[i].name.toLowerCase();
          if (attrName.startsWith('on')) {
            el.removeAttribute(attrName);
          }
        }
      });
      
      // 存儲原始元素信息
      const elementInfo = {
        element: clone,
        parent: element.parentNode,
        nextSibling: element.nextSibling,
        html: element.outerHTML,
        originalElement: element
      };
      
      // 移除原始元素
      this.removedElements.set(element, elementInfo);
      
      // 使用克隆元素替換原始元素，這樣可以保留視覺效果但移除所有事件
      element.parentNode.replaceChild(clone, element);
      
      // 如果啟用了規則保存
      if (this.settings.rememberRules) {
        this.saveRemovalRule(element);
      }
    });
  }

  undo() {
    const lastRemoved = Array.from(this.removedElements.values()).pop();
    if (lastRemoved) {
      if (lastRemoved.nextSibling) {
        lastRemoved.parent.insertBefore(lastRemoved.element, lastRemoved.nextSibling);
      } else {
        lastRemoved.parent.appendChild(lastRemoved.element);
      }
      this.removedElements.delete(lastRemoved.element);
    }
  }

  findSimilarElements(element) {
    const similarElements = [];
    const tagName = element.tagName;
    const className = element.className;
    
    // 基本相似性判斷
    const selector = className ? 
      `${tagName.toLowerCase()}.${className.split(' ').join('.')}` :
      tagName.toLowerCase();
    
    document.querySelectorAll(selector).forEach(el => {
      if (this.isSimilar(element, el)) {
        similarElements.push(el);
      }
    });
    
    return similarElements;
  }

  isSimilar(elem1, elem2) {
    // 基本屬性比較
    if (elem1.tagName !== elem2.tagName) return false;
    if (elem1.className !== elem2.className) return false;
    
    // 尺寸比較
    const rect1 = elem1.getBoundingClientRect();
    const rect2 = elem2.getBoundingClientRect();
    if (Math.abs(rect1.width - rect2.width) > 10) return false;
    if (Math.abs(rect1.height - rect2.height) > 10) return false;
    
    return true;
  }

  saveRemovalRule(element) {
    const rule = {
      tagName: element.tagName,
      className: element.className,
      id: element.id,
      path: this.getElementPath(element),
      url: window.location.hostname
    };
    
    // 儲存規則到 chrome.storage
    chrome.storage.local.get(['removalRules'], function(result) {
      const rules = result.removalRules || [];
      rules.push(rule);
      chrome.storage.local.set({ removalRules: rules });
    });
  }

  getElementPath(element) {
    let path = [];
    while (element.parentElement) {
      let selector = element.tagName.toLowerCase();
      if (element.id) {
        selector += '#' + element.id;
      } else if (element.className) {
        selector += '.' + element.className.split(' ').join('.');
      }
      path.unshift(selector);
      element = element.parentElement;
    }
    return path.join(' > ');
  }

  highlightElement(element) {
    if (element === document.body) return;
    element.classList.add('element-remover-hover');
  }

  clearHighlight() {
    document.querySelectorAll('.element-remover-hover').forEach(el => {
      el.classList.remove('element-remover-hover');
    });
  }

  activate() {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
  }

  deactivate() {
    this.isActive = false;
    document.body.style.cursor = 'default';
    this.clearHighlight();
    this.selectedElements.clear();
  }

  setMode(mode) {
    this.currentMode = mode;
    this.selectedElements.clear();
    this.clearHighlight();
    
    // 顯示模式切換提示
    if (mode === 'multi') {
      this.showNotification('multiSelectHint');
    }
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  toggleMenu() {
    console.log('toggleMenu called');  // 添加日誌
    
    if (!this.floatingMenu) {
      console.log('Creating new menu');  // 添加日誌
      this.floatingMenu = this.createFloatingMenu();
      this.showMenu();
      this.activate();
    } else {
      console.log('Toggling existing menu');  // 添加日誌
      if (this.isMenuVisible) {
        this.hideMenu();
        this.deactivate();
      } else {
        this.showMenu();
        this.activate();
      }
    }
    
    console.log('Menu visibility:', this.isMenuVisible);  // 添加日誌
  }

  isValidTarget(element) {
    // 檢查是否為插件自身的元素
    if (element.closest('.element-remover-menu') || 
        element.closest('.element-remover-notification')) {
      return false;
    }

    // 排除 body 和 html
    if (element === document.body || element === document.documentElement) {
      return false;
    }

    // 獲取元素的標籤名稱
    const tagName = element.tagName.toLowerCase();

    // 排除特定標籤
    const excludedTags = ['html', 'body', 'script', 'style', 'link', 'meta', 'head'];
    if (excludedTags.includes(tagName)) {
      return false;
    }

    return true;
  }

  getText(key, params = {}) {
    const keys = key.split('.');
    let text = this.i18n[this.currentLang];
    
    for (const k of keys) {
      text = text[k];
      if (!text) {
        // 如果找不到翻譯，使用英文
        text = this.i18n['en'];
        for (const k of keys) {
          text = text[k];
        }
        break;
      }
    }
    
    // 替換參數
    return text.replace(/\{(\w+)\}/g, (match, key) => params[key] || match);
  }

  updateMenuText() {
    const menu = document.querySelector('.element-remover-menu');
    if (!menu) return;
    
    menu.querySelector('.element-remover-header').textContent = this.getText('menuTitle');
    menu.querySelector('.mode-section h3').textContent = this.getText('selectMode');
    menu.querySelector('.rules-section h3').textContent = this.getText('rules');
    menu.querySelector('.history-section h3').textContent = this.getText('history');
    
    // 更新結束按鈕文字
    const stopButton = menu.querySelector('.stop-btn');
    if (stopButton) {
      stopButton.innerHTML = '⏹️ ' + this.getText('stopRemoving');
    }
    
    const modeButtons = menu.querySelectorAll('.mode-btn');
    modeButtons[0].innerHTML = '🎯 ' + this.getText('singleMode');
    modeButtons[1].innerHTML = '✨ ' + this.getText('multiMode');
    modeButtons[2].innerHTML = '🔍 ' + this.getText('similarMode');
    
    const autoHideLabel = menu.querySelector('#autoHide').parentElement;
    autoHideLabel.innerHTML = `
      <input type="checkbox" id="autoHide" ${autoHideLabel.querySelector('input').checked ? 'checked' : ''}>
      ${this.getText('autoHide')}
    `;
    
    const smartSelectLabel = menu.querySelector('#smartSelect').parentElement;
    smartSelectLabel.innerHTML = `
      <input type="checkbox" id="smartSelect" ${smartSelectLabel.querySelector('input').checked ? 'checked' : ''}>
      ${this.getText('smartSelect')}
    `;
    
    const historyButtons = menu.querySelectorAll('.history-actions button');
    historyButtons[0].innerHTML = '↩️ ' + this.getText('undo');
    historyButtons[1].innerHTML = '↪️ ' + this.getText('redo');
    historyButtons[2].innerHTML = '🗑️ ' + this.getText('clear');
  }
}

// 初始化
const elementManager = new ElementManager();
elementManager.init();

// 監聽來自 background 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);  // 添加日誌
  
  try {
    switch (request.action) {
      case 'toggleSelector':
        console.log('Toggling selector');  // 添加日誌
        elementManager.toggleMenu();
        sendResponse({ success: true });
        break;
      case 'setMode':
        elementManager.setMode(request.mode);
        sendResponse({ success: true });
        break;
      case 'undo':
        elementManager.undo();
        sendResponse({ success: true });
        break;
      case 'redo':
        elementManager.redo();
        sendResponse({ success: true });
        break;
      default:
        console.log('Unknown action:', request.action);  // 添加日誌
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);  // 添加錯誤日誌
    sendResponse({ success: false, error: error.message });
  }
  
  return true;  // 保持消息通道開啟
}); 