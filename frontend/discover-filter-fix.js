function rebuildDiscoverSelect(select, config){
  if(!select) return;

  var currentValue = select.value;
  var shouldShowDefault = !currentValue || currentValue === '全部' || currentValue === config.defaultValue;

  select.innerHTML = '';

  var defaultOption = document.createElement('option');
  defaultOption.value = config.defaultValue;
  defaultOption.textContent = config.defaultLabel;
  defaultOption.disabled = true;
  defaultOption.hidden = true;
  select.appendChild(defaultOption);

  config.options.forEach(function(item){
    var option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  });

  select.value = shouldShowDefault ? config.defaultValue : currentValue;
}

function patchDiscoverFilterLabels(){
  rebuildDiscoverSelect(document.querySelector('#gradedLevelFilters select'), {
    defaultValue:'default-jlpt-level',
    defaultLabel:'JLPT等级',
    options:[
      {value:'全部', label:'全部'},
      {value:'N5', label:'N5'},
      {value:'N4', label:'N4'},
      {value:'N3', label:'N3'},
      {value:'N2', label:'N2'},
      {value:'N1', label:'N1'}
    ]
  });

  rebuildDiscoverSelect(document.querySelector('#gradedTopicFilters select'), {
    defaultValue:'default-topic',
    defaultLabel:'题材',
    options:[
      {value:'全部', label:'全部'},
      {value:'生活', label:'生活类'},
      {value:'新闻', label:'新闻类'},
      {value:'旅行', label:'旅行类'},
      {value:'科技', label:'科技类'},
      {value:'美食', label:'美食类'},
      {value:'商业', label:'商业类'}
    ]
  });
}

function scheduleDiscoverFilterPatch(){
  [0, 80, 180, 360, 800, 1400].forEach(function(delay){
    setTimeout(patchDiscoverFilterLabels, delay);
  });
}

document.addEventListener('DOMContentLoaded', scheduleDiscoverFilterPatch);
window.addEventListener('load', scheduleDiscoverFilterPatch);
document.addEventListener('click', function(event){
  if(event.target.closest('[data-view="discover"], .discover-section, button, a, select')){
    scheduleDiscoverFilterPatch();
  }
});
document.addEventListener('change', function(event){
  if(event.target.closest('#gradedLevelFilters select, #gradedTopicFilters select')){
    scheduleDiscoverFilterPatch();
  }
});
