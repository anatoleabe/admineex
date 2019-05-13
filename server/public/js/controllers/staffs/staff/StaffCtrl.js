angular.module('StaffCtrl', []).controller('StaffController', function($scope, $window, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
        $ocLazyLoad.load('js/services/StaffService.js').then(function () {
            $rootScope.kernel.loading = 0;
            $scope.title = "...";
    
            $scope.myFilter = function (item) {
                return item.selected;
            };
            var Personnel = $injector.get('Staff');
            $ocLazyLoad.load('js/services/DictionaryService.js').then(function() {
                var Dictionary = $injector.get('Dictionary');
                Dictionary.jsonList({dictionary: 'structure', levels: ['types']}).then(function (response) {
                    $scope.types = response.data;
                    Dictionary.jsonList({dictionary: 'structure', levels: ['ranks']}).then(function (response) {
                        $scope.ranks = response.data;

                            $rootScope.kernel.loading = 100;
                            // Modify or Add ?
                            if ($stateParams.id !== undefined) {
                                $scope.new = false;
                                Personnel.read({
                                    id: $stateParams.id
                                }).then(function (response) {
                                    $scope.personnel = response.data;
                                }).catch(function (response) {
                                    $rootScope.kernel.alerts.push({
                                        type: 1,
                                        msg: gettextCatalog.getString('An error occurred, please try again later'),
                                        priority: 2
                                    });
                                    console.error(response);
                                });
                            } else {
                                $scope.new = true;
                                $scope.title = gettextCatalog.getString('New');
                                $scope.structure = {};
                            }

                            // Add or edit new Personnel
                            $scope.submit = function () {
                                $rootScope.kernel.loading = 0;
                                $scope.personnel.en = $scope.structure.fr;
                                Personnel.upsert($scope.personnel).then(function (response) {
                                    $rootScope.kernel.loading = 100;
                                    $state.go('home.staffs.staffmanagement');
                                    $rootScope.kernel.alerts.push({
                                        type: 3,
                                        msg: gettextCatalog.getString('The agent has been saved'),
                                        priority: 4
                                    });
                                }).catch(function (response) {
                                    $rootScope.kernel.loading = 100;
                                    $rootScope.kernel.alerts.push({
                                        type: 1,
                                        msg: gettextCatalog.getString('An error occurred, please try again later'),
                                        priority: 2
                                    });
                                    console.error(response);
                                });
                            }
                        });
                    });
                });
    });
});
