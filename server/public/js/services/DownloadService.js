angular.module('DownloadService', []).factory('Download', function($http) {
    return {
        start: function(config) {
            config.responseType = "arraybuffer";
            return $http.get(config.url, config);
        }
    }
});