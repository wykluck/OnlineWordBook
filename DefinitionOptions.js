//It is necessary to hook up the button event handler dynamically rather than inline
//to follow the Content Security Policy for Chrome Developers.
window.addEventListener("load", function()
{
  document.getElementById("submit_button")
          .addEventListener("click", submitDef, false);
  document.getElementById("close_button")
          .addEventListener("click", closeWindow, false);
  document.getElementById("pronounce_button")
          .addEventListener("click", pronounce, false);
}, false);

var selectedWord;
var contentTabId;
var spinner;
var dbStorage = chrome.extension.getBackgroundPage().dbStorage;
var manifest = chrome.runtime.getManifest();
var curSoundUrl = null;
var curPronunciationSymbol = null;

function enableSpinningWheel(enable)
{
    if (enable)
    {
      if (spinner == null)
        spinner = new Spinner(opts).spin($('.option_items') );
      else
        spinner.spin($('.option_items'));
    }
    else
    {
       if (spinner != null)
        spinner.stop();
    }  
}

function pronounce()
{
    if (curSoundUrl != null)
    {
      var audio = new Audio(curSoundUrl);
      audio.play(); 
    }
}

function setDefOptions(word, defArr, soundUrl, pronunciationSymbol, tabId) {
    selectedWord = word;
    contentTabId = tabId;

    $('#word_text').text(word);
    $('#pronunciation_symbol').text('{' + pronunciationSymbol + '}');
    curSoundUrl = soundUrl;
    curPronunciationSymbol = pronunciationSymbol;
    
    var optionDiv = $('.option_items');
    optionDiv.empty();
    var id = 1;
    defArr.forEach(function(entry){
      if (entry.dt.length > 0)
      {
          $('<input />', { type: 'radio', id: 'rd'+id, name: "def_option"}).appendTo(optionDiv);
          $('<label />', { id: 'word_rd'+id, text: entry.name + ':' }).appendTo(optionDiv);
          $('<label />', { 'for': 'rd'+id, text: '{' + entry.fl + '}' + entry.dt }).appendTo(optionDiv);
          $('<br />').appendTo(optionDiv);
          id++;
      } 
    });
}

function saveItemToDoc(response, doc, sentenceStr)
{
    var items = doc.data;
    var itemObj = {};
    var defHash = response.def.hashCode();
    itemObj[response.defWord] = {};
    //example such as:
    // itemObj = {"request":
    //    "pr": 'ri quest' ,
    //    12345:{
    //      "defintion": "request def",
    //      "examples":  ["I request him to do the job."]
    //    },
    //    "soundurl": 'http://abc.wav'
    //  }
    itemObj[response.defWord][defHash] = {'definition': response.def, 'examples':[response.example]};
    itemObj[response.defWord]['soundUrl'] = curSoundUrl;
    itemObj[response.defWord]['pron'] = curPronunciationSymbol;
    if (Object.keys(items).length === 0 && items.constructor === Object)
    {
          //no items against manifest.name yet, create it
          dbStorage.getLocalDB().put({
            _id: manifest.name, 
            _rev: doc._rev,
            data: itemObj
          }).catch(function (err) {
          console.log(err);
          });
    }
    else
    {
          if (items.hasOwnProperty(response.defWord))
          {
              //otherwise, push the definition and sentence to the entry
              if (items[response.defWord].hasOwnProperty(defHash))
              {
                  //if it has the definition, push the sentenceStr to examples array
                  items[response.defWord][defHash]['examples'].push(response.example);
              }
              else
              {

                  items[response.defWord][defHash]['examples'] = [response.example];
              }
          }
          else
          {
              //the item does not have request.word as a key-value pair, create an entry
              items[response.defWord] = itemObj[response.defWord];
          }
          //save the modified item to chrome sync storage
          dbStorage.getLocalDB().put({
            _id: manifest.name, 
            _rev: doc._rev,
            data: items
          }).catch(function (err) {
              console.log(err);
          });
    }
    //close the window
    window.close();
}

function saveDefToStorage(response)
{
    // Save it using the Chrome extension storage API.
    dbStorage.getLocalDB().get(manifest.name).then(function(doc) {
        saveItemToDoc(response, doc);
    }).catch(function (err) {
      if (err.status == 404)
      {
        //haven't been created, create it.
        dbStorage.getLocalDB().put({
            _id: manifest.name, 
            data: {}
          }).catch(function (err) {
          console.log(err);
        });
        dbStorage.getLocalDB().get(manifest.name).then(function(doc) {
          saveItemToDoc(response, doc);
        });
      }
      else
        console.log(err);
    }); 
}

function submitDef() {
  //collect users input result of selecting definition options 
  var checkedBoxes = $(':radio:checked');
  var selectedDef;
  var defWord;
  checkedBoxes.each(function(index){
     var eleId = $(this).attr('id');
     selectedDef = $('label[for="'+ eleId + '"]').text();
     var selectedWordLabel = $('label#word_' + eleId).text();
     defWord = selectedWordLabel.match(/[a-z]+/gi)[0];
  })

  //save the result to the corresponding content page
  if (selectedDef != null)
  {
    chrome.tabs.sendMessage(contentTabId, {'selectedWord': selectedWord, 'defWord': defWord, 'def': selectedDef}, function(response) {
       console.log(response);
       if (response.needToSaveToStorage)
          saveDefToStorage(response);
       else
       {
          //close the window
          window.close();
       }
    }); 
  }
  else
  {
    alert("No definition is selected for submitting on word \"" + curWord + "\"");
  }
}

function closeWindow() {
  //close the window
  window.close();
}