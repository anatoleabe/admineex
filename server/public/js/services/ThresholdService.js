angular.module('ThresholdService', []).factory('Threshold', ['$http', function($http) {
    return {
        list: function(config) {
            return $http.get('/api/thresholds');
        },
        
        save: function(config) {
            return $http.post('/api/thresholds', config);
        }
    }
}]);