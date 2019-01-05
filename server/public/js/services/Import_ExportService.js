angular.module('Import_ExportService', []).factory('Import_Export', function($http) {
    return {
        import: function(info) {
            return $http.post('/api/import', info);
        }
    }
});
