angular.module('StatsWidgetDirective', []).directive('statsWidget', function() {
    return {
        restrict: 'E',
        scope: {
            title: '@',
            value: '=',
            subtitle: '@',
            icon: '@',
            color: '@',
            loading: '='
        },
        templateUrl: 'templates/dashboard/widgets/stats-widget.html',
        link: function(scope, element, attrs) {
            scope.cardClass = 'stats-card bg-' + (scope.color || 'primary');
        }
    };
});
