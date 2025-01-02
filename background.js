// 監聽插件安裝或更新事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('Element Remover installed/updated');
});

// 監聽擴充功能圖標點擊事件
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked');  // 添加日誌
  
  // 檢查是否是有效的標籤頁
  if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
    console.log('Sending toggleSelector message to tab:', tab.id);  // 添加日誌
    
    // 向內容腳本發送消息
    chrome.tabs.sendMessage(tab.id, {
      action: 'toggleSelector'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);  // 添加錯誤日誌
      } else {
        console.log('Message sent successfully, response:', response);  // 添加日誌
      }
    });
  } else {
    console.log('Invalid tab URL:', tab.url);  // 添加日誌
  }
}); 