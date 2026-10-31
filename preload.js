const {contextBridge} = require('electron');

contextBridge.exposeInMainWorld('dishDeck', {
  isReady: true
});
