var manifestName = chrome.runtime.getManifest().name;
var optionSetting = chrome.extension.getBackgroundPage().optionSetting;
$(document).ready(function () {
    restore_options();
    $('#save').click(save_options);
});

// Saves options to chrome.storage.sync.
function save_options() {
  var item = {};
  item[manifestName] = {'langOption': $('#langOption').val()};
  chrome.storage.local.set(item, function() {
    // Update status to let user know options were saved.
    $('#status').text('Options saved.');
    setTimeout(function() {
      $('#status').text('');
    }, 750);
    //make the background page load the current option setting
    optionSetting.set(item[manifestName].langOption);
  });
 
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  chrome.storage.local.get(manifestName, function(item) {
    if (item != null && !jQuery.isEmptyObject(item))
      optionSetting.set(item[manifestName].langOption);
    $('#langOption').val(optionSetting.getLangOption());
  });
  
}
