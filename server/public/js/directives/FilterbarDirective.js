angular.module('FilterbarDirective', []).directive('filterbar', ['gettextCatalog', '$ocLazyLoad', '$injector', '$rootScope', '$state', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope, $state) {
        return {
            restrict: 'A',
            scope: {
                search: '=',
                select: '=',
                daterange: '=',
                province: '=',
                district: '=',
                labs: '=',
                path: '=',
                disableThemes: '='
            },
            templateUrl: 'templates/filterbar.html',
            link: function ($scope, $element, $attrs) {
                $ocLazyLoad.load('js/services/UIService.js').then(function () {
                    var UI = $injector.get('UI');
                    $ocLazyLoad.load('js/services/UserService.js').then(function () {
                        var User = $injector.get('User');
                        User.list().then(function (response) {
                            $scope.users = response.data;
                            $scope.rootscope = $rootScope;
                            
                            $scope.$watch(function () {
                                return $rootScope.range.from.value;
                            }, function () {
                                $scope.from = $rootScope.range.from.value;
                            }, true);

                            $scope.$watch(function () {
                                return $rootScope.range.to.value;
                            }, function () {
                                $scope.to = $rootScope.range.to.value;
                            }, true);
                           

                            $scope.from = $rootScope.range.from.value;
                            $scope.to = $rootScope.range.to.value;


                            $scope.$on('$destroy', function () {
                                //$rootScope.path.cards = undefined;
                            });
                        });
                    });
                });
            }
        }
    }]);