angular.module('Procras5Directive', []).directive('procras5', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            task: '=',
            status: '='
        },
        replace: true,
        templateUrl: 'templates/statistics/procrastinate/directives/procras5.html',
        link: function ($scope, $element, $attrs, scope) {
            $scope.loadingChart = true;
            $scope.labels = [gettextCatalog.getString('Not stared'), gettextCatalog.getString('In progress'), gettextCatalog.getString('Completed')];
            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');

                $scope.colors = ["#E91E63", "#2196F3", "#CCCCCC"];
                $scope.options = {
                    tooltips: {
                        callbacks: {
                            label: function (tooltipItem, data) {
                                var datasetLabel = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                                var total = data.datasets[tooltipItem.datasetIndex].data[0] + data.datasets[tooltipItem.datasetIndex].data[1];
                                var percent = Math.round((datasetLabel * 100) / total);
                                var label = data.labels[tooltipItem.index];
                                return label + gettextCatalog.getString(':') + ' ' + '(' + datasetLabel + ')' + ' ' + percent + '%';
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'bottom',
                        reverse: true
                    }
                }

                function build() {
                    $scope.loadingChart = false;
                    $scope.data = [
                        10,
                        20,
                        30
                    ];
                }
                build();
            });
        }
    };
});
