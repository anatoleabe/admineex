angular.module('AuditCtrl', [[
    'node_modules/angular-material-data-table/dist/md-data-table.min.css'
]]).controller('AuditController', function($scope, gettextCatalog, $state, $ocLazyLoad, $injector, $rootScope, $http, $q) {
    $rootScope.kernel.loading = 100;
    $scope.options = {
        limit: [50, 100]
    };
    $scope.query = {
        order: '-date',
        limit: 100,
        page: 1
    };
    
    $scope.filter = {
        max: new Date(),
        min: new Date(1970, 0, 1),
        from: new Date(new Date().setDate(new Date().getDate() - 1)),
        to: new Date(),
        show: false
    }

    $scope.load = function (){
        if(($scope.filter.from && $scope.filter.to) && ($scope.filter.from <= $scope.filter.to)){
            var deferred = $q.defer();
            $scope.promise = deferred.promise;
            $http.get('/api/audit/from/'+$scope.filter.from+'/to/'+$scope.filter.to).then(function(response){
                var data = response.data;
                $scope.logs = {
                    data: data,      
                    count: data.length
                };
                deferred.resolve(data);
            }).catch(function(response) {
                console.log(response);
            });
        }
    }
    $scope.load();
});