angular.module('DownloadService', []).factory('Download', ['CancellableHTTP', function(CancellableHTTP) {
    return {
        start: function(config) {
            config.responseType = "arraybuffer";
            return CancellableHTTP.get(config.url, config);
        }
    }
}]);