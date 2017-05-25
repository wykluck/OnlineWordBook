var tranWinObj = {id: -1};
var learnWinObj = {id: -1};
var contentTabId = null;
var manifestName = chrome.runtime.getManifest().name;
var defaultApiKeys = ['5b3ee6f5-fb78-42fc-8598-82ae5eae13e6', 
  'e13396e5-7356-47a1-9793-a5be7c6deda8'];


var optionSetting = (function (){
  
  var _langOption = 'zh-CN';

  return {
    getLangOption: function() {
      return _langOption;
    },

    set: function(langOption) {
      _langOption = langOption;
    }
  }
}());


var dbStorage = (function() {
   var db_ = null;
   var currentUserEmail_ = "";
   var dbName_ = "";
   var remoteDbUrl_ = "";
   

   function getDbName(email) {
      var dbName = manifestName;
      if (email != null && email.length > 0)
        dbName = manifestName + '_' + email.replace('@', '_at_').replace('.','_dot_');
      dbName = dbName.toLowerCase();
      return dbName;
   };

   function OpenDBAgainstEmail(){
      var promise = new Promise(function(resolve, reject){
         chrome.identity.getProfileUserInfo(function(userInfo) {
              resolve(userInfo.email);
         })
      });
      promise.then(function(email){    
          if (currentUserEmail_ != email)
          {
            currentUserEmail_ = email;
            if (db_ != null)
            {  
                //first close the existing db and set true to needToOpen 
                return db_.close().then(function()
                {
                   return true;
                });
            }
            //db is not open yet, just set true to needToOpen
            return true; 
          }
          else//email not changed, no need to reopen db
          {
            if (db_ == null)
              //db is not open yet, just set true to needToOpen
              return true;
            else
              return false;
          }
      }).then(function(needToOpen){
          if (needToOpen) 
          {
             dbName_ = getDbName(currentUserEmail_);
             remoteDbUrl_ = "https://onlinewordbook.smileupps.com/" + dbName_;
             db_ = new PouchDB(dbName_, {storage: "persistent"});
             //make sure the remote db is created using a server admin credential
             if (currentUserEmail_.length > 0)
             {
                var remoteDb = new PouchDB(remoteDbUrl_//, 
                  //{auth: {
                  //  username: 'dbcreator',
                  //  password: 'secret'
                  //}}
                );
             }
          }  
      });
   }

   /**
    *Periodically open db against the email
    */
   function periodicOpenDB()
   {
     OpenDBAgainstEmail();
     setTimeout(function(){
          periodicOpenDB();
     }, 60000);
   };

   periodicOpenDB();
  
   return {
     getLoginDetail: function()
     {
        return currentUserEmail_;
     },

     getLocalDB: function() {
        return db_;
     },

     getRemoteDBUrl: function() {
        return remoteDbUrl_;
     }
  }
}());

chrome.storage.local.get(manifestName, function(item) {
    if (item != null && !jQuery.isEmptyObject(item))
       optionSetting.set(item[manifestName].langOption);
});

/**
 * Create a translate window according to the url
 */
function createPopupWindow(url, winObj)
{
    chrome.windows.getCurrent(null, function(curWindow)
    {
        var tranWindowTop = curWindow.top;
        var tranWindowLeft = curWindow.left + curWindow.width;
        chrome.windows.create(
          {
            url: url, 
            type: 'panel',
            state: 'docked', 
            left: tranWindowLeft,
            top: tranWindowTop,
            width: 600,
            height: 400
          }, 
          function(window) {
            winObj.id = window.id;
        });
    })
}


function translate(selectedText)
{
  var translateUrl = 'https://translate.google.com/#auto/' + optionSetting.getLangOption() + '/' + selectedText;
  if (tranWinObj.id < 0)
  {
     //translate window is not created , create it
     createPopupWindow(translateUrl, tranWinObj);
  }
  else
  {
    var getInfo = {populate: true};
    chrome.windows.get(tranWinObj.id, getInfo, 
      function(window) {
        if (window != null)
        {
            //find the translate window, update it with the new url
            chrome.tabs.update(window.tabs[0].id, 
              {url: translateUrl},
              function() {
                chrome.windows.update(window.id, {focused: true});
              });   
        }
        else
        {
            //translate window has been closed, recreate it.
            createPopupWindow(translateUrl, tranWinObj);
        }
      });
  }
}



function learn(selectedText)
{
  //evenly use apikeys
  var randomIndex = (new Date().getTime()) % defaultApiKeys.length;
  var learnUrl = 'http://www.dictionaryapi.com/api/v1/references/learners/xml/' + 
      selectedText  + '?key=' + defaultApiKeys[randomIndex];
  $.ajax(
      {
       type: "Get",
       url: learnUrl,
       success: function(data) {
          var defArr = [];
          var soundUrl = "";
          var pronoucationSymbol = "";
          try
          {
            var resultXml = $(data);
            resultXml.find("entry")
                .filter(function() {
                   var objName = this.id;
                   var flName = $(this).children("fl")[0];
                   pronoucationSymbol = $($(this).children("pr")[0]).text();
                   if (pronoucationSymbol.length == 0)
                      pronoucationSymbol = $($(this).children("altpr")[0]).text();
                   if (pronoucationSymbol.length == 0)
                      pronoucationSymbol = $($($(this).children('vr')[0]).children('pr')[0]).text();
                   if (pronoucationSymbol.length == 0)
                      pronoucationSymbol = $($($(this).children('vr')[0]).children('altpr')[0]).text();
                   $(this).children('def').children('dt').each(function(){
                       var defObj = {};
                      defObj.name = objName;
                      defObj.fl = $(flName).text();
                      defObj.dt = null;
                      var directText = $(this).clone().children().remove().end().text();
                      if (/^:[a-zA-Z]+/.test(directText))
                       {
                          //remove the first colon
                          defObj.dt = directText.substr(1).replace(':', ';');
                       }
                       else
                       {
                          defObj.dt = $(this).find("sx").text();

                       }
                      defArr.push(defObj);
                   });
                   
                });
             //find the pronoucation url
             resultXml.find("sound").find('wav').each(function() {
                var wavFileName = $(this).text();
                var subFolderName = '';
                if (wavFileName.startsWith('bix'))
                {
                    subFolderName = 'bix';
                }
                else if (wavFileName.startsWith('gg'))
                {
                    subFolderName = 'gg';
                }
                else if (wavFileName.match(/^[0-9]+.*/))
                {
                    subFolderName = 'number';
                }
                else
                {
                    subFolderName = wavFileName.charAt(0);
                }
                soundUrl = 'http://media.merriam-webster.com/soundc11/' + subFolderName + '/' + wavFileName;
             });
          }
          catch (err)
          {
             //Invalid API key
             alert(data);
             return;
          }
          if (defArr.length == 0)
          {
            //no definitions, just return;
            alert("No definition is found for word " + selectedText);
            return;
          }
          if (learnWinObj.id > 0)
          {
            chrome.windows.remove(learnWinObj.id);    
          }
          createPopupWindow("DefinitionOptions.html", learnWinObj);
          setTimeout(function(){
            var defWindowArr = chrome.extension.getViews({windowId: learnWinObj.id});
             if (defWindowArr.length > 0)
             {
                defWindowArr[0].setDefOptions(selectedText, defArr, soundUrl, pronoucationSymbol, contentTabId); 
             }
             //window.enableSpinningWheel(false);
          }, 2000);
        }
      });
}

/**
 * Returns a handler which will open a new window when activated.
 */
function getClickHandler(actionFunc) {
  return function(info, tab) {
    contentTabId = tab.id;
    actionFunc(info.selectionText.trim());
 };
};

/**
 * Create a context menu which will only show up for selections.
 */
chrome.contextMenus.create({
  "title" : "Translate (Alt+T)",
  "type" : "normal",
  "contexts" : ["selection"],
  "onclick" : getClickHandler(translate)
});

chrome.contextMenus.create({
  "title" : "Learn  (Alt+L)",
  "type" : "normal",
  "contexts" : ["selection"],
  "onclick" : getClickHandler(learn)
});



/**
 * Trigger translate-text function through the shortcut key
 */
chrome.commands.onCommand.addListener(function(command) {
    
    if (command == 'translate-text' || command == 'learn-text')
    {
        var actionFunc = translate;
        if (command == 'learn-text')
          actionFunc = learn;
        chrome.tabs.getSelected(function(tab){
          contentTabId = tab.id;
          chrome.tabs.executeScript(tab.id, {
              code: "window.getSelection().toString();"
          }, 
          function(selection) {
                //make sure some text is selected 
                if (selection != null && selection.length > 0 && selection[0].trim().length > 0)
                {
                  actionFunc(selection[0].trim());
                }
          });
        });   
    }

});