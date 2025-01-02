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
    this.i18n = null;  // 初始化為 null
    
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
  }

  async loadLanguages() {
    try {
      const response = await fetch(chrome.runtime.getURL('languages.json'));
      this.i18n = await response.json();
      console.log('Languages loaded:', this.i18n);  // 添加日誌
    } catch (error) {
      console.error('Error loading languages:', error);
      // 如果加載失敗，使用預設的英文
      this.currentLang = 'en';
      this.i18n = {
        en: {
          menuTitle: "Element Remover Pro",
          // ... 其他預設英文翻譯
        }
      };
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
    menu.style.position = 'fixed';
    menu.style.left = '20px';
    menu.style.top = '20px';
    
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
      if (mode.id === this.currentMode) {
        button.classList.add('active');
      }
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
    languageTitle.textContent = this.getText('languageSettings');
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
    
    // 修正拖曳功能
    this.makeDraggable(menu);
    this.setupMenuListeners();
    
    return menu;
  }

  makeDraggable(menu) {
    const header = menu.querySelector('.element-remover-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    const dragStart = (e) => {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;

      if (e.target === header) {
        isDragging = true;
      }
    };

    const dragEnd = () => {
      isDragging = false;
    };

    const drag = (e) => {
      if (isDragging) {
        e.preventDefault();
        
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        menu.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }
    };

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
  }

  setupMenuListeners() {
    const menu = this.floatingMenu;
    if (!menu) return;

    // 模式選擇按鈕
    menu.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        menu.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setMode(btn.dataset.mode);
      });
    });

    // 規則設定
    const autoHideCheckbox = menu.querySelector('#autoHide');
    if (autoHideCheckbox) {
      autoHideCheckbox.checked = this.settings.autoHide;
      autoHideCheckbox.addEventListener('change', (e) => {
        this.settings.autoHide = e.target.checked;
        this.saveSettings();
      });
    }

    const smartSelectCheckbox = menu.querySelector('#smartSelect');
    if (smartSelectCheckbox) {
      smartSelectCheckbox.checked = this.settings.smartSelect;
      smartSelectCheckbox.addEventListener('change', (e) => {
        this.settings.smartSelect = e.target.checked;
        this.saveSettings();
      });
    }

    // 歷史操作按鈕
    const undoBtn = menu.querySelector('.history-actions button:first-child');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.undo());
    }

    const redoBtn = menu.querySelector('.history-actions button:last-child');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.redo());
    }

    // 語言選擇
    const languageSelect = menu.querySelector('.language-select');
    if (languageSelect) {
      languageSelect.value = this.currentLang;
      languageSelect.addEventListener('change', (e) => {
        this.saveLanguagePreference(e.target.value);
      });
    }

    // 停止按鈕
    const stopBtn = menu.querySelector('.stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.deactivate();
        this.hideMenu();
        this.showNotification('notifications.removingStopped');
      });
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
    try {
      const message = this.getText(messageKey, params);
      
      // 移除舊的通知
      const oldNotification = document.querySelector('.element-remover-notification');
      if (oldNotification) {
        oldNotification.remove();
      }
      
      const notification = document.createElement('div');
      notification.className = 'element-remover-notification';
      notification.textContent = message;
      document.body.appendChild(notification);
      
      // 2秒後自動移除
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.remove();
        }
      }, 2000);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
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
    
    try {
      if (this.currentMode === 'multi') {
        if (e.shiftKey) {
          // Shift + 點擊 = 刪除所有選中的元素
          const elements = Array.from(this.selectedElements);
          if (elements.length > 0) {
            this.removeElements(elements);
            this.selectedElements.clear();
          }
        } else {
          // 一般點擊 = 選擇元素
          this.toggleElementSelection(target);
          // 當選擇第一個元素時顯示提示
          if (this.selectedElements.size === 1) {
            setTimeout(() => {
              this.showNotification('notifications.shiftClickTip');
            }, 500);
          }
        }
      } else if (this.currentMode === 'similar') {
        const similarElements = this.findSimilarElements(target);
        if (similarElements.length > 0) {
          this.removeElements(similarElements);
        }
      } else {
        // 單一模式
        this.removeElements([target]);
      }
    } catch (error) {
      console.error('Error handling click:', error);
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
    try {
      const validElements = elements.filter(element => this.isValidTarget(element));
      
      if (validElements.length === 0) {
        return;
      }
      
      validElements.forEach(element => {
        // 保存元素的原始狀態
        const elementInfo = {
          element: element,
          parent: element.parentNode,
          nextSibling: element.nextSibling,
          html: element.outerHTML
        };
        
        // 從 DOM 中移除元素
        if (element.parentNode) {
          element.parentNode.removeChild(element);
          
          // 將元素添加到已移除列表
          this.removedElements.set(element, elementInfo);
          
          // 清除選中狀態
          this.selectedElements.delete(element);
        }
      });
      
      // 顯示通知
      if (validElements.length === 1) {
        this.showNotification('elementRemoved');
      } else {
        this.showNotification('elementsRemoved', { count: validElements.length });
      }
      
      // 清除高亮
      this.clearHighlight();
      
    } catch (error) {
      console.error('Error removing elements:', error);
    }
  }

  undo() {
    try {
      const entries = Array.from(this.removedElements.entries());
      const lastEntry = entries.pop();
      
      if (!lastEntry) {
        this.showNotification('noMoreUndo');
        return;
      }
      
      const [element, info] = lastEntry;
      
      // 恢復元素
      if (info.nextSibling) {
        info.parent.insertBefore(info.element, info.nextSibling);
      } else {
        info.parent.appendChild(info.element);
      }
      
      // 從移除列表中刪除
      this.removedElements.delete(element);
      
      // 添加到重做堆疊
      this.redoStack.set(element, info);
      
      this.showNotification('undoSuccess');
    } catch (error) {
      console.error('Error undoing:', error);
    }
  }

  redo() {
    try {
      const entries = Array.from(this.redoStack.entries());
      const lastEntry = entries.pop();
      
      if (!lastEntry) {
        this.showNotification('noMoreRedo');
        return;
      }
      
      const [element, info] = lastEntry;
      
      // 重新移除元素
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      
      // 從重做堆疊中刪除
      this.redoStack.delete(element);
      
      // 添加回移除列表
      this.removedElements.set(element, info);
      
      this.showNotification('redoSuccess');
    } catch (error) {
      console.error('Error redoing:', error);
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
    
    // 移除任何現有的高亮
    element.classList.remove('element-remover-hover');
    element.classList.remove('element-remover-selected');
    element.classList.remove('element-remover-similar');
    
    // 根據當前模式添加適當的高亮
    if (this.currentMode === 'similar') {
      element.classList.add('element-remover-similar');
    } else if (this.selectedElements.has(element)) {
      element.classList.add('element-remover-selected');
    } else {
      element.classList.add('element-remover-hover');
    }
  }

  clearHighlight() {
    document.querySelectorAll('.element-remover-hover, .element-remover-similar').forEach(el => {
      el.classList.remove('element-remover-hover', 'element-remover-similar');
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
    
    // 更新按鈕狀態
    if (this.floatingMenu) {
      const buttons = this.floatingMenu.querySelectorAll('.mode-btn');
      buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
          btn.classList.add('active');
        }
      });
    }
    
    // 顯示模式切換提示
    let modeText = '';
    switch (mode) {
      case 'single':
        modeText = this.getText('singleMode');
        break;
      case 'multi':
        modeText = this.getText('multiMode');
        // 立即顯示多選模式的操作提示
        setTimeout(() => {
          this.showNotification('notifications.shiftClickTip');
        }, 1000);
        break;
      case 'similar':
        modeText = this.getText('similarMode');
        break;
    }
    this.showNotification('notifications.modeChanged', { mode: modeText });
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  async toggleMenu() {
    console.log('toggleMenu called');
    
    // 確保語言檔案已載入
    if (!this.i18n) {
      console.log('Loading languages first');
      await this.loadLanguages();
    }
    
    if (!this.floatingMenu) {
      console.log('Creating new menu');
      this.floatingMenu = this.createFloatingMenu();
      this.showMenu();
      this.activate();
    } else {
      console.log('Toggling existing menu');
      if (this.isMenuVisible) {
        this.hideMenu();
        this.deactivate();
      } else {
        this.showMenu();
        this.activate();
      }
    }
    
    console.log('Menu visibility:', this.isMenuVisible);
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
    if (!this.i18n) {
      console.error('Language data not loaded');
      return key;  // 返回 key 作為後備
    }

    try {
      const keys = key.split('.');
      let text = this.i18n[this.currentLang];
      
      // 如果當前語言不存在，使用英文
      if (!text) {
        text = this.i18n['en'];
      }
      
      // 遍歷鍵值取得翻譯
      for (const k of keys) {
        text = text[k];
        if (!text) {
          console.warn(`Translation not found for key: ${key}`);
          return key;  // 返回 key 作為後備
        }
      }
      
      // 替換參數
      return text.replace(/\{(\w+)\}/g, (match, key) => params[key] || match);
    } catch (error) {
      console.error('Error getting text:', error);
      return key;  // 返回 key 作為後備
    }
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