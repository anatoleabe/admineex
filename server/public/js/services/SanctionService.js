angular.module('SanctionService', []).factory('Sanction', function($http) {
    return {
        list: function(info) {
            var limit = info.limit?info.limit:0;
            var skip = info.skip?info.skip:0;
            var search = info.search?info.search:"-";
            var filters = info.filters?info.filters:"-";
            return $http.get('/api/sanctions/' + limit + '/' + skip+ '/'+search + '/'+filters);
        },
        sanction: function(info) {
            return $http.put('/api/sanctions', info);
        },
        delete: function(info) {
            return $http.delete('/api/sanctions/' + info.id);
        },
        export: function(info) {
            var filters = info.filters?info.filters:"-";
            return $http.get('/api/sanctionsExport/'+filters);
        },
        statistics: function(info) {
            var filters = info.filters?info.filters:"-";
            return $http.get('/api/sanctionsStatistics/'+filters);
        }
    }
});