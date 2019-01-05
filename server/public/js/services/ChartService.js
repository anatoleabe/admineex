angular.module('ChartService', []).factory('Chart', function($http) {
    return {
        build: function(config) {
            return $http.get('/api/charts/'+config.name+'/from/'+config.from+'/to/'+config.to+'/group/'+config.group);
        }
    }
});