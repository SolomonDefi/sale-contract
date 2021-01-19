const SolomonSale = artifacts.require('SolomonSale');
const contract = require('@truffle/contract');
const constants = require('../test/util.js')(web3);
SlmTokenData = require('slm-token/build/contracts/SlmToken.json');
const SlmToken = contract(SlmTokenData);
SlmToken.setProvider(web3.currentProvider);

module.exports = async function(deployer, network, accounts) {
  let tokenAddress;
  if(network === 'test') {
    const supply = web3.utils.toWei('100000000', 'ether');
    await deployer.deploy(SlmToken, 'SlmToken', 'SLM', supply, accounts[0], { from: accounts[0] });
    tokenAddress = SlmToken.address;
  } else if(network.startsWith('ropsten')) {
    tokenAddress = '0x98e399c372df175978911456Af44FA26104428D5';
  } else if(network.startsWith('mainnet')) {
    tokenAddress = '0x07a0ad7a9dfc3854466f8f29a173bf04bba5686e';
  } else {
    return;
  }

  const { initialExchangeRate, minExchange, maxExchange } = constants;
  await deployer.deploy(
    SolomonSale, tokenAddress, initialExchangeRate, minExchange, maxExchange,
    { from: accounts[1] },
  );
};
