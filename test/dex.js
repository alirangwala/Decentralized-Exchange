const { expectRevert } = require('@openzeppelin/test-helpers')
const Dai = artifacts.require('../contracts/Dai.sol')
const Bat = artifacts.require('../contracts/Bat.sol')
const Rep = artifacts.require('../contracts/Rep.sol')
const Zrx = artifacts.require('../contracts/Zrx.sol')
const Dex = artifacts.require('../contracts/Dex.sol')

const SIDE = {
  BUY: 0,
  SELL: 1
}

contract('Dex', (accounts) => {
  let dai, bat, rep, zrx, dex;

  const [trader1, trader2] = [accounts[1], accounts[2]];
  const [DAI, BAT, REP, ZRX] = ['DAI', 'BAT', 'REP', 'ZRX']
    .map(ticker => web3.utils.fromAscii(ticker));

  beforeEach(async () => {
    ([dai, bat, rep, zrx] = await Promise.all([
      Dai.new(),
      Bat.new(),
      Rep.new(),
      Zrx.new()
    ]));
    dex = await Dex.new();
    await Promise.all([
      dex.addToken(DAI, dai.address),
      dex.addToken(BAT, bat.address),
      dex.addToken(REP, rep.address),
      dex.addToken(ZRX, zrx.address)
    ]);

    const amount = web3.utils.toWei('1000');
    const seedTokenBalance = async (token, trader) => {
      await token.faucet(trader, amount);
      await token.approve(
        dex.address,
        amount,
        { from: trader }
      )
    }

    await Promise.all(
      [dai, bat, rep, zrx].map(
        token => seedTokenBalance(token, trader1))
    );
    await Promise.all(
      [dai, bat, rep, zrx].map(
        token => seedTokenBalance(token, trader2))
    )
  });
  it('should deposit tokens', async () => {
    const amount = web3.utils.toWei('100');
    await dex.deposit(
      amount,
      DAI,
      { from: trader1 }
    );
    const balance = await dex.traderBalances(trader1, DAI);
    assert(balance.toString() === amount)
  })

  it('should not deposit token if token does NOT exist', async () => {
    await expectRevert(
      dex.deposit(
        web3.utils.toWei('100'),
        web3.utils.fromAscii('Token-Does-NOT-exist'),
        { from: trader1 }
      ), 'This token does not exist')
  })

  it('should withdraw tokens', async () => {
    const amount = web3.utils.toWei('100');
    await dex.deposit(
      amount,
      DAI,
      { from: trader1 }
    );
    await dex.withdraw(
      amount,
      DAI,
      { from: trader1 }
    );
    const [balanceDex, balanceDai] = await Promise.all([
      dex.traderBalances(trader1, DAI),
      dai.balanceOf(trader1)
    ]);
    assert(balanceDex.isZero());
    assert(balanceDai.toString() === web3.utils.toWei('1000'));
  });

  it('should not withdraw token if token does NOT exist', async () => {
    await expectRevert(
      dex.withdraw(
        web3.utils.toWei('100'),
        web3.utils.fromAscii('Token-Does-NOT-exist'),
        { from: trader1 }
      ), 'This token does not exist')
  });

  it('should not withdraw token if the balance is too low', async () => {
    await dex.deposit(
      web3.utils.toWei('100'),
      DAI,
      { from: trader1 })
    await expectRevert(
      dex.withdraw(
        web3.utils.toWei('200'),
        DAI,
        { from: trader1 }
      ), 'insufficient balance')
  })

  it('should create limit order', async () => {
    await dex.deposit(
      web3.utils.toWei('100'),
      DAI,
      { from: trader1 })

    await dex.createLimitOrder(
      REP,
      web3.utils.toWei('10'),
      10,
      SIDE.BUY,
      { from: trader1 }
    );
    let buyOrders = await dex.getOrders(REP, SIDE.BUY);
    let sellOrders = await dex.getOrders(REP, SIDE.SELL);
    assert(buyOrders.length === 1);
    assert(buyOrders[0].trader = trader1);
    assert(buyOrders[0].ticker = web3.utils.padRight(REP, 64));
    assert(buyOrders[0].price = '10');
    assert(buyOrders[0].amount = web3.utils.toWei('10'));
    assert(sellOrders.length === 0);

    await dex.deposit(
      web3.utils.toWei('200'),
      DAI,
      { from: trader2 })

    await dex.createLimitOrder(
      REP,
      web3.utils.toWei('10'),
      11,
      SIDE.BUY,
      { from: trader2 }
    );
    buyOrders = await dex.getOrders(REP, SIDE.BUY);
    sellOrders = await dex.getOrders(REP, SIDE.SELL);
    assert(buyOrders.length === 2);
    assert(buyOrders[0].trader = trader2);
    assert(buyOrders[1].trader = trader1);
    assert(sellOrders.length === 0);

    await dex.createLimitOrder(
      REP,
      web3.utils.toWei('10'),
      9,
      SIDE.BUY,
      { from: trader2 }
    );
    buyOrders = await dex.getOrders(REP, SIDE.BUY);
    sellOrders = await dex.getOrders(REP, SIDE.SELL);
    assert(buyOrders.length === 3);
    assert(buyOrders[0].trader = trader2);
    assert(buyOrders[1].trader = trader1);
    assert(buyOrders[2].trader = trader2);
    assert(buyOrders[2].price = '9');
    assert(sellOrders.length === 0);
  })
  it('should NOT make limit order if token does not exist', async () => {
    await expectRevert(
      dex.createLimitOrder(
        web3.utils.fromAscii('Token-does-NOT-exist'),
        web3.utils.toWei('10'),
        10,
        SIDE.BUY,
        { from: trader1 }
      ), 'This token does not exist')
  })
  it('should NOT make limit order with DAI', async () => {
    await expectRevert(
      dex.createLimitOrder(
        DAI,
        web3.utils.toWei('10'),
        10,
        SIDE.BUY,
        { from: trader1 }
      ), 'cannot trade DAI')
  })
  it('should NOT make limit order if the token balance is too low', async () => {
    await dex.deposit(
      web3.utils.toWei('99'),
      REP,
      { from: trader1 })
    await expectRevert(
      dex.createLimitOrder(
        REP,
        web3.utils.toWei('100'),
        10,
        SIDE.SELL,
        { from: trader1 }
      ), 'insufficient balance')
  })

  it('should NOT make limit order if the DAI balance is too low', async () => {
    await dex.deposit(
      web3.utils.toWei('99'),
      DAI,
      { from: trader1 })
    await expectRevert(
      dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        10,
        SIDE.BUY,
        { from: trader1 }
      ), 'insufficient DAI balance')
  })
  it('should create market order and match against existing limit order', async () => {
    await dex.deposit(
      web3.utils.toWei('100'),
      DAI,
      { from: trader1 }
    )
    await dex.createLimitOrder(
      REP,
      web3.utils.toWei('10'),
      10,
      SIDE.BUY,
      { from: trader1 }
    )
    await dex.deposit(
      web3.utils.toWei('100'),
      REP,
      { from: trader2 }
    )
    await dex.createMarketOrder(
      REP,
      web3.utils.toWei('5'),
      SIDE.SELL,
      { from: trader2 }
    )

    const balances = await Promise.all([
      dex.traderBalances(trader1, DAI),
      dex.traderBalances(trader1, REP),
      dex.traderBalances(trader2, DAI),
      dex.traderBalances(trader2, REP)
    ])
    const orders = await dex.getOrders(REP, SIDE.BUY);
    assert(orders[0].filled === web3.utils.toWei('5'));
    assert(balances[0].toString() === web3.utils.toWei('50'));
    assert(balances[1].toString() === web3.utils.toWei('5'));
    assert(balances[2].toString() === web3.utils.toWei('50'));
    assert(balances[3].toString() === web3.utils.toWei('95'));
  })

  it('should NOT make market order if token does not exist', async () => {
    await expectRevert(
      dex.createMarketOrder(
        web3.utils.fromAscii('Token-does-NOT-exist'),
        web3.utils.toWei('1000'),
        SIDE.BUY,
        { from: trader1 }
      ), 'This token does not exist')
  })
  it('should NOT make limit market with DAI', async () => {
    await expectRevert(
      dex.createMarketOrder(
        DAI,
        web3.utils.toWei('1000'),
        SIDE.BUY,
        { from: trader1 }
      ), 'cannot trade DAI')
  })
  it('should NOT make market order if the token balance is too low', async () => {
    await dex.deposit(
      web3.utils.toWei('99'),
      REP,
      { from: trader1 })
    await expectRevert(
      dex.createMarketOrder(
        REP,
        web3.utils.toWei('100'),
        SIDE.SELL,
        { from: trader1 }
      ), 'insufficient balance')
  })

  it('should NOT make market order if the DAI balance is too low', async () => {
    await dex.deposit(
      web3.utils.toWei('100'),
      REP,
      { from: trader1 })
    await dex.createLimitOrder(
      REP,
      web3.utils.toWei('100'),
      10,
      SIDE.SELL,
      { from: trader1 }
    )
    await expectRevert(
      dex.createMarketOrder(
        REP,
        web3.utils.toWei('101'),
        SIDE.BUY,
        { from: trader2 }
      ), 'insufficient DAI balance')
  })
})
