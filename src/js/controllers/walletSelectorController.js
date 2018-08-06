'use strict';

angular.module('copayApp.controllers').controller('walletSelectorController', function($scope, $rootScope, $state, $log, $ionicHistory, configService, gettextCatalog, profileService, txFormatService) {

  var priceDisplayAsFiat = false;
  var requestedSatoshis = 0;
  var unitDecimals = 0;
  var unitsFromSatoshis = 0;

  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    var config = configService.getSync().wallet.settings;
    priceDisplayAsFiat = config.priceDisplay === 'fiat';
    unitDecimals = config.unitDecimals;
    unitsFromSatoshis = 1 / config.unitToSatoshi;

    switch($state.current.name) {
      case 'tabs.send.wallet-to-wallet':
        $scope.sendFlowTitle = gettextCatalog.getString('Wallet to Wallet Transfer');
        break;
      case 'tabs.send.destination':
        if (data.stateParams.fromWalletId) {
          $scope.sendFlowTitle = gettextCatalog.getString('Wallet to Wallet Transfer');
        }
        break;
      default:
       // nop
    }

    $scope.params = $state.params;
    $scope.coin = false; // Wallets to show (for destination screen or contacts)
    $scope.type = data.stateParams && data.stateParams['fromWalletId'] ? 'destination' : 'origin'; // origin || destination

    if ($scope.params.coin) {
      $scope.coin = $scope.params.coin; // Contacts have a coin embedded
    }

    if ($scope.params.amount) { // There is an amount, so presume that it is a payment request
      $scope.sendFlowTitle = gettextCatalog.getString('Payment Request');
      $scope.specificAmount = $scope.specificAlternativeAmount = '';
      //requestedAmountCrypto = (($state.params.amount) * (1 / config.unitToSatoshi)).toFixed(config.unitDecimals);
      requestedSatoshis = $state.params.amount;
      $scope.isPaymentRequest = true;
    }
    if ($scope.params.thirdParty) {
      $scope.thirdParty = JSON.parse($scope.params.thirdParty); // Parse stringified JSON-object
    }
  });

  $scope.$on("$ionicView.enter", function(event, data) {
    configService.whenAvailable(function(config) {
      $scope.selectedPriceDisplay = config.wallet.settings.priceDisplay;
    });

    $scope.walletsEmpty = []; // empty wallets for origin screen

    if ($scope.type === 'origin') {
      $scope.headerTitle = gettextCatalog.getString('Choose a wallet to send from');
      $scope.walletsEmpty = profileService.getWallets({coin: $scope.coin, hasNoFunds: true});
    } else if ($scope.type === 'destination') {
      $scope.fromWallet = profileService.getWallet(data.stateParams.fromWalletId);
      $scope.coin = $scope.fromWallet.coin; // Only show wallets with the select origin wallet coin
      $scope.headerTitle = gettextCatalog.getString('Choose a wallet to send to');
    }

    if ($scope.thirdParty) {
      // Third party services specific logic
      handleThirdPartyIfBip70PaymentProtocol();
      handleThirdPartyIfShapeshift();
    }

    if (!$scope.coin || $scope.coin === 'bch') { // if no specific coin is set or coin is set to bch
      $scope.walletsBch = profileService.getWallets({coin: 'bch', hasFunds: $scope.type==='origin'});
    }
    if (!$scope.coin || $scope.coin === 'btc') { // if no specific coin is set or coin is set btc
      $scope.walletsBtc = profileService.getWallets({coin: 'btc', hasFunds: $scope.type === 'origin'});
    }

    formatRequestedAmount();
  });

  function formatRequestedAmount() {
    if (requestedSatoshis) {
      var cryptoAmount = (unitsFromSatoshis * requestedSatoshis).toFixed(unitDecimals);
      var cryptoCoin = $scope.coin.toUpperCase();

      txFormatService.formatAlternativeStr($scope.coin, requestedSatoshis, function onFormatAlternativeStr(formatted){
        if (formatted) {
          var fiatParts = formatted.split(' ');
          var fiatAmount = fiatParts[0];
          var fiatCurrrency = fiatParts.length > 1 ? fiatParts[1] : '';

          if (priceDisplayAsFiat) {
            $scope.requestAmount = fiatAmount;
            $scope.requestCurrency = fiatCurrrency;

            $scope.requestAmountSecondary = cryptoAmount;
            $scope.requestCurrencySecondary = cryptoCoin;
          } else {
            $scope.requestAmount = cryptoAmount;
            $scope.requestCurrency = cryptoCoin;

            $scope.requestAmountSecondary = fiatAmount;
            $scope.requestCurrencySecondary = fiatCurrrency;
          }
        }
      }); 
    }
  }

  function getNextStep() {
    if ($scope.thirdParty) {
      $scope.params.thirdParty = JSON.stringify($scope.thirdParty)  // re-stringify JSON-object
    }
    if (!$scope.params.toWalletId && !$scope.params.toAddress) { // If we have no toAddress or fromWallet
      return 'tabs.send.destination';
    } else if (!$scope.params.amount) { // If we have no amount
      return 'tabs.send.amount';
    } else { // If we do have them
      return 'tabs.send.confirm';
    }
  }

  function handleThirdPartyIfBip70PaymentProtocol() {
    if ($scope.thirdParty.id === 'bip70PaymentProtocol') {
      $scope.coin = $scope.thirdParty.coin;
      $scope.requestAmount = unitsFromSatoshis * $scope.thirdParty.details.amount;
      console.log('paypro details:', $scope.thirdParty.details);
    }
  }

  function handleThirdPartyIfShapeshift() {
    if ($scope.thirdParty.id === 'shapeshift' && $scope.type === 'destination') { // Shapeshift wants to know the
      if ($scope.coin === 'bch') {
        $scope.coin = 'btc';
      } else {
        $scope.coin = 'bch';
      }
    } 
  }

  

  $scope.useWallet = function(wallet) {
    if ($scope.type === 'origin') { // we're on the origin screen, set wallet to send from
      $scope.params['fromWalletId'] = wallet.id;
    } else { // we're on the destination screen, set wallet to send to
      $scope.params['toWalletId'] = wallet.id;
    }
    $state.transitionTo(getNextStep(), $scope.params);
  };

  $scope.goBack = function() {
    $ionicHistory.goBack();
  }

});