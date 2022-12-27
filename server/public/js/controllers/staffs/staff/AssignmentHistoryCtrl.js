angular.module('AssignmentHistoryCtrl', []).controller('AssignmentHistoryController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.params = params;
    $scope.affectations = []

    $scope.query = {
        limit: 25,
        page: 1,
        order: "-lastModified"
    };

    $scope.helper = {
        title: gettextCatalog.getString("No Assignement found"),
    };


    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };





    $ocLazyLoad.load('js/services/AffectationService.js').then(function () {
        var Affectation = $injector.get('Affectation');

        $scope.getAffectations = function () {

            var deferred = $q.defer();

            $rootScope.kernel.loading = 0;
            $scope.helper = [];
            var limit = $scope.query.limit;
            var skip = $scope.query.limit * ($scope.query.page - 1);
            var filterParams = {}
            Affectation.list({limit: limit, skip: skip, search: $scope.search, filters: JSON.stringify(filterParams)}).then(function (response) {
                var data = response.data;
                $rootScope.kernel.loading = 100;

                $scope.affectations = {
                    data: data,
                    count: data.length
                };
                return deferred.promise;
            }).catch(function (response) {
                console.log(response);
            });
        }
        $scope.getAffectations();





        var watch = {};
        watch.search = $scope.$watch('search', function (newval, oldval) {
            if (newval) {
                $scope.getAffectations();
            }
        });

        $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
            watch.search();
        });


        $scope.affect = function () {
            $ocLazyLoad.load('js/controllers/administration/positions/AffectationCtrl.js').then(function () {
                $mdDialog.show({
                    controller: 'AffectationController',
                    templateUrl: '../templates/dialogs/affectation.html',
                    parent: angular.element(document.body),
                    clickOutsideToClose: true,
                    locals: {
                        params: {
                        }
                    }
                }).then(function (answer) {
                    $scope.getAffectations();
                }, function () {
                });
            });
        };

        $scope.showConfirm = function (affectation) {
            var confirm = $mdDialog.confirm()
                    .title(gettextCatalog.getString("Cancel this affectation"))
                    .textContent(gettextCatalog.getString("Are you sure you want to cancel the affectation of") + " " + affectation.fname + gettextCatalog.getString("?"))
                    .ok(gettextCatalog.getString("Delete"))
                    .cancel(gettextCatalog.getString("Cancel"));

            $mdDialog.show(confirm).then(function () {
                // Delete
                Affectation.delete({
                    id: affectation._id
                }).then(function (response) {
                    $scope.getAffectations();
                    $rootScope.kernel.alerts.push({
                        type: 3,
                        msg: gettextCatalog.getString('The affectation has been canceled successfully'),
                        priority: 4
                    });
                }).catch(function (response) {
                    console.log(response);
                });
            }, function () {
                // Cancel
            });
        }



    });
});
