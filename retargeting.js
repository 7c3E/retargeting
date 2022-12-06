(function () {
  if (document.readyState !== 'loading') {
    return checkPass();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();

function checkPass() {
  var env = window.ecConfig.env;
  var encryptedOrgId = window.ecConfig.encryptedOrgId;

  var apiUrl;
  switch (env) {
    case 'local':
      apiUrl = `http://localhost:8081`;
      break;
    case 'staging':
    case 'frontend':
      apiUrl = 'https://stage-api-next.no8.io';
      break;
    case 'prod':
      apiUrl = 'https://api-next.no8.io';
      break;
    default:
      apiUrl = 'http://localhost:8081';
  }

  var checkPassUrl = new URL(apiUrl + '/ec/retargeting/checkDomainPass');
  checkPassUrl.searchParams.append('encryptedOrgId', encryptedOrgId);

  var httpRequest = createRequest('GET', checkPassUrl.toString(), true);
  if (!httpRequest) {
    console.error('No httpRequest');
    destroy();
    return;
  }
  httpRequest.send();
  httpRequest.onload = function () {
    if (httpRequest.readyState !== XMLHttpRequest.DONE) {
      destroy();
      return;
    }
    if (httpRequest.status !== 200) {
      console.error(
        'Request problem',
        httpRequest.status,
        httpRequest.responseText,
      );
      destroy();
      return;
    }
    try {
      var response = JSON.parse(httpRequest.responseText);
      if (!response.success) {
        console.error(response);
        destroy();
        return;
      }
    } catch (err) {
      console.error(err.message);
      destroy();
      return;
    }
    return init();
  };
  httpRequest.onerror = function () {
    console.error('There was an error!');
    destroy();
    return false;
  };
}

function createRequest(method, url, async) {
  var xhr = new XMLHttpRequest();
  if ('withCredentials' in xhr) {
    xhr.open(method, url, async);
  } else if (typeof XDomainRequest !== 'undefined') {
    xhr = new XDomainRequest();
    xhr.open(method, url);
  } else {
    xhr = null;
  }
  return xhr;
}

function init() {
  var urlSearchParams = new URLSearchParams(window.location.search);
  var params = Object.fromEntries(urlSearchParams.entries()) || {};
  var env = window.ecConfig.env;

  if (params.encrypted) {
    sessionStorage.setItem('encrypted', params.encrypted);
    window.location.href = window.location.origin + window.location.pathname;
  }

  function getEcCid(provider) {
    switch (provider) {
      case 'shopline':
        return ((window.mainConfig || {}).currentUser || {})._id;
      default:
        return undefined;
    }
  }

  window.retargetNo8 = function (eventType, items) {
    var isRetargetEventType =
      eventType === 'add_to_cart' ||
      eventType === 'remove_from_cart' ||
      eventType === 'purchase';

    if (!window.isSending && isRetargetEventType) {
      window.isSending = true;
      var encrypted = sessionStorage.getItem('encrypted');
      var ecCid = getEcCid(window.ecConfig.provider);

      if (ecCid || encrypted) {
        var body = {
          items: items,
          encrypted: encrypted,
          event: eventType,
          provider: window.ecConfig.provider,
          orgId: window.ecConfig.orgId,
          ecCid: getEcCid(window.ecConfig.provider),
        };

        var apiUrl;
        switch (env) {
          case 'local':
            apiUrl = `http://localhost:8082`;
            break;
          case 'staging':
          case 'frontend':
            apiUrl = 'https://stage-receiver-next.no8.io';
            break;
          case 'prod':
            apiUrl = 'https://receiver-next.no8.io';
            break;
          default:
            apiUrl = 'http://localhost:8082';
        }

        fetch(apiUrl + '/ec/retargeting', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
          .then(function () {
            window.isSending = false;
          })
          .catch(function () {
            window.isSending = false;
          });
      }
    }
  };
}

function destroy() {
  window.retargetNo8 = function () {};
  sessionStorage.removeItem('encrypted');
}
