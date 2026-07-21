(function installMvpStabilityFixes(){
  function selectedDetailSurface(){
    return document.querySelector('#detailArea .detail-word')?.textContent?.trim() || '';
  }

  function restoreSelectedDetail(surface){
    if(!surface) return;
    window.setTimeout(() => {
      const restoredNode = [...document.querySelectorAll('#output .w')].find(node => {
        const baseText = node.querySelector('rb')?.textContent || node.firstChild?.textContent || '';
        return baseText.trim() === surface;
      });
      if(restoredNode) restoredNode.click();
    }, 0);
  }

  document.addEventListener('keydown', event => {
    if(event.key !== 'Enter' || event.target?.id !== 'rubyEditInput') return;
    const surface = selectedDetailSurface();
    window.setTimeout(() => restoreSelectedDetail(surface), 0);
  }, true);

  document.addEventListener('click', event => {
    if(!event.target.closest('.save-ruby-tool')) return;
    const surface = selectedDetailSurface();
    window.setTimeout(() => restoreSelectedDetail(surface), 0);
  }, true);

  function syncPortraitPptAvailability(){
    const formatSelect = document.getElementById('exportFormatSelect');
    const layoutSelect = document.getElementById('exportLayoutSelect');
    const portraitOption = layoutSelect?.querySelector('option[value="portrait"]');
    if(!formatSelect || !layoutSelect || !portraitOption) return;
    const portraitPptUnavailable = formatSelect.value === 'pptx';
    portraitOption.hidden = portraitPptUnavailable;
    portraitOption.disabled = portraitPptUnavailable;
    if(portraitPptUnavailable && layoutSelect.value === 'portrait'){
      layoutSelect.value = 'landscape';
    }
    const note = document.getElementById('exportFormatNote');
    if(note && portraitPptUnavailable){
      note.textContent = 'PPTX（可编辑）暂仅支持横版。';
    }
  }

  function wrapExportFunction(name, syncBefore = false){
    const original = window[name];
    if(typeof original !== 'function') return;
    window[name] = function wrappedExportFunction(){
      if(syncBefore) syncPortraitPptAvailability();
      const result = original.apply(this, arguments);
      if(!syncBefore) syncPortraitPptAvailability();
      return result;
    };
  }

  wrapExportFunction('openExportModal');
  wrapExportFunction('syncExportOptions');
  wrapExportFunction('runExport', true);
  syncPortraitPptAvailability();
})();
