angular.module('MonitorService', []).factory('Monitor', function($http) {
    return {
        list: function(info) {
            return $http.get('/api/monitor/'+info.year+'/'+info.quarter+'/'+info.structure);
        }
    }
});