// 監聽插件安裝或更新事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('Element Remover installed/updated');
});

// 監聽擴充功能圖標點擊事件
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Extension icon clicked');

  try {
    // 檢查是否是有效的標籤頁
    if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
      console.log('Valid tab URL:', tab.url);

      // 確保內容腳本已經載入
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // 等待一下確保腳本已經完全載入
      await new Promise(resolve => setTimeout(resolve, 100));

      // 發送消息到內容腳本
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'toggleSelector'
      }).catch(error => {
        console.error('Error sending message:', error);
        return null;
      });

      console.log('Message response:', response);
    } else {
      console.log('Invalid tab URL:', tab.url);
    }
  } catch (error) {
    console.error('Error in click handler:', error);
  }
}); 