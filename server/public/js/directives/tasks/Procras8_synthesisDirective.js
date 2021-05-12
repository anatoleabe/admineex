angular.module('Procras8_synthesisDirective', [[
    'node_modules/angular-material-data-table/dist/md-data-table.min.css'
]]).directive('procras8synthesis', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            task: '=',
            status: '='
        },
        replace: true,
        templateUrl: 'templates/statistics/procrastinate/directives/procras8_synthesis.html',
        link: function ($scope, $element, $attrs, scope) {
            $scope.loadingChart = true;
            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');
                $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                    var Card = $injector.get('Chart');

                    var CARD_NAME = "procras8_synthesis";
                  
                    
                    function build() {
                        var params = {
                            name: CARD_NAME,
                            from: $rootScope.range.from.value,
                            to: $rootScope.range.to.value,
                            globalView: $rootScope.globalView
                        };
                        Card.build(params).then(function (response) {
                            $scope.synthesis = response.data;
                            $scope.loadingChart = false;
                        }).catch(function (response) {
                            if (response.xhrStatus !== "abort") {
                                console.error(response);
                                $rootScope.kernel.alerts.push({
                                    type: 1,
                                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                                    priority: 2
                                });
                            }
                            $scope.loadingChart = false;
                        });
                    }
                    $scope.loadingChart = true;
                    build();
                    
                    var watch = {};
                    watch.range = $rootScope.$watch('range', function (newValue, oldValue) {
                        if (newValue.from.value.getTime() !== oldValue.from.value.getTime() || newValue.to.value.getTime() !== oldValue.to.value.getTime()) {
                            $scope.loadingChart = true;
                            build();
                        }
                    }, true);
                    watch.selectedUser = $rootScope.$watch('globalView.selectedUser', function (newValue, oldValue) {
                        if (newValue !== oldValue) {
                            $scope.loadingChart = true;
                            build();
                        }
                    }, true);
                    $scope.$on('$destroy', function () {// in case of directive destroy, we destroy the watch
                        watch.range();
                        watch.selectedUser();
                    });
                });
            });
        }
    };
});
