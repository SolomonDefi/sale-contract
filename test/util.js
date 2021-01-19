
module.exports = (web3) => {

  function toSlm(number) {
    return web3.utils.toBN(web3.utils.toWei(number.toString(), 'ether'));
  }
  
  async function shouldRevert(action, message) {
    const REVERT_ERROR = 'Returned error: VM Exception while processing transaction: revert';
    try {
      await action;
    } catch(error) {
      // This is now a workaround since we are including require messages
      const err = error.message.slice(0, REVERT_ERROR.length);
      assert.equal(err, REVERT_ERROR, message);
      return;
    }
    assert.equal(false, true, message);
  }

  async function assertBalance(token, wallet, amount, message) {
    const balance = (await token.balanceOf(wallet)).toString();
    const expect = web3.utils.toBN(amount);
    assert.equal(balance.toString(), expect.toString(), message);
  }

  return {
    toSlm,
    shouldRevert,
    assertBalance,
    minExchange: web3.utils.toWei('0.1', 'ether'),
    maxExchange: web3.utils.toWei('20', 'ether'),
    initialExchangeRate: web3.utils.toBN('25000'),
  }
};
