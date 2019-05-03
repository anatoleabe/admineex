angular.module('PositionsCtrl', []).controller('PositionsController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope, $q) {
    $ocLazyLoad.load('js/services/PositionService.js').then(function () {
        var Position = $injector.get('Position');
        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
            var Structure = $injector.get('Structure');
            var helper = {
                title: gettextCatalog.getString("No position"),
                icon: "account_balance"
            };

            $scope.organizations = [], $scope.helper = [];
            $scope.search = false;
            $scope.filters = {};
            $scope.structures = [];
            $scope.query = {
                limit: 50,
                page: 1,
                order: "code"
            };

            $scope.details = function (params) {
                $state.go("home.administration.details", params);
            };

            function getPositions(idStructure) {
                $scope.helper = [];
                var deferred = $q.defer();
                $scope.promise = deferred.promise;
                Position.list({id: idStructure}).then(function (response) {
                    var data = response.data;
                    if (data.length == 0 && $scope.helper.length == 0) {
                        $scope.helper = helper;
                    }
                    $rootScope.kernel.loading = 100;
                    $scope.positions = data;
                    deferred.resolve();
                }).catch(function (response) {
                    console.error(response);
                });
            }
            getPositions(-1);

            $scope.filterByStructure = function (idStructure) {
                getPositions(idStructure);
            };


            $scope.$watch('filters.structure', function (newval, oldval) {
                if (newval) {
                    newval = JSON.parse(newval).code;
                    getPositions(newval ? newval : "-1");
                }
            });

            //Load structure list
            Structure.list().then(function (response) {
                var data = response.data;
                if (data.length == 0 && $scope.helper.length == 0) {
                    $scope.helper = helper;
                }
                $scope.structures = data;
            }).catch(function (response) {
                console.error(response);
            });

//        function deletePositions(id){
//            Position.delete({
//                id : id
//            }).then(function(response){
//                getPositions(-1);
//                $rootScope.kernel.alerts.push({
//                    type: 3,
//                    msg: gettextCatalog.getString('The organization has been deleted'),
//                    priority: 4
//                });
//            }).catch(function(response) {
//                console.error(response);
//            });
//        }

            $scope.showConfirm = function (organization) {
                var confirm = $mdDialog.confirm()
                        .title(gettextCatalog.getString("Delete this organization"))
                        .textContent(gettextCatalog.getString("Are you sure you want to delete the organization") + " " + organization.name + gettextCatalog.getString("?"))
                        .ok(gettextCatalog.getString("OK"))
                        .cancel(gettextCatalog.getString("Cancel"));

                $mdDialog.show(confirm).then(function () {
                    // Delete
                    deletePosition(organization._id)
                }, function () {
                    // Cancel
                });
            }
        });
    });
});
