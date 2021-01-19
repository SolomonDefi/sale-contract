const SolomonSale = artifacts.require('SolomonSale');
const TruffleContract = require('@truffle/contract');
SlmTokenData = require('slm-token/build/contracts/SlmToken.json');
const SlmToken = TruffleContract(SlmTokenData);
SlmToken.setProvider(web3.currentProvider);
const {
  initialExchangeRate,
  minExchange,
  maxExchange,
  assertBalance,
  shouldRevert,
  toSlm,
} = require('./util.js')(web3);

const toBN = (thing) => web3.utils.toBN(thing);

contract('SolomonSale', (accounts) => {
  const tokenOwner = accounts[0];
  const saleOwner = accounts[1];
  const user1 = accounts[2];
  const user2 = accounts[3];
  const user3 = accounts[4];
  it('is initialized correctly', async () => {
    const token = await SlmToken.deployed();
    const sale = await SolomonSale.deployed();

    await token.unlock({ from: tokenOwner });

    // Initial balance of token owner is total supply, sale balance is 0, sale owner balance is 0
    const expectSupply = toSlm('100000000');
    const supply = await token.totalSupply();
    assert.equal(supply.toString(), expectSupply.toString(), 'Totaly supply incorrect');

    await assertBalance(token, tokenOwner, supply, 'Supply not in creator account');
    await assertBalance(token, saleOwner, 0, 'Sale owner should have no tokens');
    await assertBalance(token, sale.address, 0, 'Sale should have no tokens');

    // Initial sale conditions
    const saleExchange = await sale.exchangeRate();
    assert.equal(initialExchangeRate.toString(), saleExchange.toString(), 'Bad initial exchange rate');

    const saleMin = await sale.minimum();
    const saleMax = await sale.maximum();
    assert.equal(minExchange.toString(), saleMin.toString(), 'Bad initial minimum');
    assert.equal(maxExchange.toString(), saleMax.toString(), 'Bad initial maximum');

    const availableTokens = await sale.availableTokens();
    assert.equal(availableTokens.toString(), '0', 'No tokens should be available');

    const paused = await sale.paused();
    assert(!paused, 'Sale should start unpaused');
  });

  it('can be updated by the owner', async () => {
    const sale = await SolomonSale.deployed();

    // Update all possible settings, then reset to default
    const newExchange = '500';
    await sale.setExchangeRate(newExchange, { from: saleOwner });
    const saleExchange = await sale.exchangeRate();
    assert.equal(newExchange, saleExchange.toString(), 'Bad exchange rate');
    await sale.setExchangeRate(initialExchangeRate, { from: saleOwner });

    const newMin = toSlm('2');
    await sale.setMinimumExchange(newMin, { from: saleOwner });
    const saleMin = await sale.minimum();
    assert.equal(newMin.toString(), saleMin.toString(), 'Bad minimum');
    await sale.setMinimumExchange(minExchange, { from: saleOwner });

    const newMax = toSlm('9');
    await sale.setMaximumExchange(newMax, { from: saleOwner });
    const saleMax = await sale.maximum();
    assert.equal(newMax.toString(), saleMax.toString(), 'Bad maximum');
    await sale.setMaximumExchange(maxExchange, { from: saleOwner });

    await sale.pause({ from: saleOwner });
    let paused = await sale.paused();
    assert(paused, 'Sale should be paused');

    await sale.unpause({ from: saleOwner });
    paused = await sale.paused();
    assert(!paused, 'Sale should be unpaused');

    await shouldRevert(
      sale.setExchangeRate('999', { from: tokenOwner }),
      'Only sale owner can set exchange rate',
    );
    await shouldRevert(
      sale.setMinimumExchange('11', { from: tokenOwner }),
      'Only sale owner can set minimum',
    );
    await shouldRevert(
      sale.setMaximumExchange('888', { from: tokenOwner }),
      'Only sale owner can set maximum',
    );
    await shouldRevert(sale.pause({ from: tokenOwner }), 'Only sale owner can pause');
    await shouldRevert(sale.unpause({ from: tokenOwner }), 'Only sale owner can unpause');
  });

  it('correctly exchanges ETH for ERC20 tokens', async () => {
    const token = await SlmToken.deployed();
    const sale = await SolomonSale.deployed();

    // Provide tokens and check balance
    const saleTokens = toSlm('1000000');
    await token.transfer(sale.address, saleTokens, { from: tokenOwner });
    let saleBalance = await sale.availableTokens();
    assert.equal(saleTokens.toString(), saleBalance.toString(), 'Sale should receive tokens');

    // Purchase SLM with 2 ETH
    const purchase = toSlm('2');
    await sale.exchange({ value: purchase, from: user1 });
    const contribution = await sale.getContribution(user1);
    assert.equal(
      purchase.toString(),
      contribution.toString(),
      'Purchase amount should match contribution',
    );
    saleBalance = await sale.availableTokens();
    const tokensSold = purchase.mul(initialExchangeRate);
    assert.equal(
      saleBalance.toString(),
      saleTokens.sub(tokensSold).toString(),
      'Remaining sale tokens after purchase',
    );
    const saleEth = await web3.eth.getBalance(sale.address);
    assert.equal(saleEth.toString(), purchase.toString(), 'Sale did not receive ETH');
    await assertBalance(token, user1, tokensSold, 'User did not receive tokens');
  });

  it('correctly exchanges ETH for ERC20 tokens with payable fallback', async () => {
    const token = await SlmToken.deployed();
    const sale = await SolomonSale.deployed();

    const currentSaleEth = toBN(await web3.eth.getBalance(sale.address));
    const currentUserTokens = toBN(await token.balanceOf(user1));

    // Purchase using fallback function
    const purchase = toSlm('3');
    await sale.sendTransaction({ value: purchase, from: user1 });
    const saleEth = await web3.eth.getBalance(sale.address);
    assert.equal(
      saleEth.toString(),
      purchase.add(currentSaleEth).toString(),
      'Sale did not receive ETH from fallback',
    );
    const expectTokens = currentUserTokens.add(purchase.mul(initialExchangeRate));
    await assertBalance(token, user1, expectTokens, 'User did not receive tokens');
  });

  it('does not allow exchanges when the sale is paused', async () => {
    const sale = await SolomonSale.deployed();
    const token = await SlmToken.deployed();
    const currentUserTokens = toBN(await token.balanceOf(user1));

    await sale.pause({ from: saleOwner });

    const purchase = toSlm('4');
    await shouldRevert(
      sale.exchange({ value: purchase, from: user1 }),
      'Cannot exchange when paused',
    );

    await shouldRevert(
      sale.sendTransaction({ value: purchase, from: user1 }),
      'Fallback should revert when paused',
    );

    // Can transfer again after unpause
    await sale.unpause({ from: saleOwner });
    await sale.exchange({ value: purchase, from: user1 });
    const expectTokens = currentUserTokens.add(purchase.mul(initialExchangeRate));
    await assertBalance(token, user1, expectTokens, 'User did not receive tokens');
  });

  it('correctly updates the exchange rate', async () => {
    const sale = await SolomonSale.deployed();
    const token = await SlmToken.deployed();
    const currentUser2Tokens = toBN(await token.balanceOf(user2));
    const purchase = toSlm('4');

    const newExchange = toBN('100');
    await sale.setExchangeRate(newExchange, { from: saleOwner });

    await sale.exchange({ value: purchase, from: user2 });
    const expectTokens = currentUser2Tokens.add(purchase.mul(newExchange));
    await assertBalance(token, user2, expectTokens, 'User did not receive tokens');
  });

  it('fails to exchange when requirements not met', async () => {
    const sale = await SolomonSale.deployed();

    const tooLow = toSlm('0.05');
    await shouldRevert(
      sale.exchange({ value: tooLow, from: user3 }),
      'Exchange below minimum',
    );

    const tooMuch = toBN(maxExchange).add(toSlm(1));
    await shouldRevert(
      sale.exchange({ value: tooMuch, from: user3 }),
      'Exchange over maximum',
    );
  });

  it('completes successfully', async () => {
    const sale = await SolomonSale.deployed();
    const token = await SlmToken.deployed();
    const saleOwnerTokens1 = toBN(await token.balanceOf(saleOwner));
    const saleOwnerEth1 = toBN(await web3.eth.getBalance(saleOwner));

    const expectEth = toBN(await web3.eth.getBalance(sale.address));
    assert(expectEth.gt(toBN(0)), 'Sale should have some eth');

    const expectTokens = toBN(await token.balanceOf(sale.address));
    assert(expectTokens.gt(toBN(0)), 'Sale should still have some tokens');

    // Ensure regular user cannot withdraw tokens or ETH
    await shouldRevert(sale.recoverTokens({ from: user3 }), 'User cannot recover tokens');
    await shouldRevert(sale.withdrawEth({ from: user3 }), 'User cannot withdraw ETH');

    // Recover remaining tokens and withdraw ETH
    const r1 = await sale.recoverTokens({ from: saleOwner, gasPrice: '1' });
    const saleOwnerTokens2 = toBN(await token.balanceOf(saleOwner));
    assert.equal(
      saleOwnerTokens1.add(expectTokens).toString(),
      saleOwnerTokens2.toString(),
      'Sale owner did not receive tokens',
    );

    const r2 = await sale.withdrawEth({ from: saleOwner, gasPrice: '1' });
    const saleEth = toBN(await web3.eth.getBalance(sale.address));
    assert(saleEth.eq(toBN(0)), 'Sale should not have any ETH left');

    const saleOwnerEth2 = toBN(await web3.eth.getBalance(saleOwner));
    const gasCost = toBN(r1.receipt.gasUsed).add(toBN(r2.receipt.gasUsed));
    assert.equal(
      saleOwnerEth2.add(gasCost).sub(expectEth).toString(),
      saleOwnerEth1.toString(),
      'Sale owner did not receive ETH',
    );

    // User can no longer contribute when tokens are gone
    const amount = toSlm('0.3');
    await shouldRevert(
      sale.exchange({ value: amount, from: user3 }),
      'Not enough tokens for exchange',
    );
  });
});