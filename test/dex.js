const Dai = artifacts.require('../contracts/Dai.sol')
const Bat = artifacts.require('../contracts/Bat.sol')
const Rep = artifacts.require('../contracts/Rep.sol')
const Zrx = artifacts.require('../contracts/Zrx.sol')
const Dex = artifacts.require('../contracts/Dex.sol')

contract('Dex', () => {
  let dai, bat, rep, zrx, dex;

  const [DAI, BAT, REP, ZRX] = ['DAI', 'BAT', 'REP', 'ZRX']
    .map(ticker => web3.utils.fromAscii(ticker))

  beforeEach(async () => {
    ([dai, bat, rep, zrx] = await Promise.all([
      Dai.new(),
      Bat.new(),
      Rep.new(),
      Zrx.new()
    ]));
    dex = await Dex.new()

    await Promise.all([
      dex.addToken(DAI, dai.address),
      dex.addToken(BAT, bat.address),
      dex.addToken(REP, rep.address),
      dex.addToken(ZRX, zrx.address)
    ])
  });
})