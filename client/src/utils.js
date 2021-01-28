import Web3 from 'web3';
import Dex from './contracts/Dex.json';
import ERC20Abi from './ERC20Abi.json';

const getWeb3 = () => {
  return new Promise((resolve, reject) => {
    window.addEventListener('load', async () => {
      if (window.ethereum) {
        const web3 = new Web3(window.ethereum)
        try {
          await window.ethereum.enable()
          resolve(web3)
        } catch (error) {
          reject(error)
        }
      }
      else if (window.web3) {
        resolve(window.web3)
      } else {
        reject('Must install Metamask')
      }
    });
  });
}

const getContracts = async web3 => {
  const networkId = await web3.eth.net.getId();
  const contractDeployment = Dex.networks[networkId];
  const dex = new web3.eth.Contract(
    Dex.abi,
    contractDeployment && contractDeployment.address
  );
  const tokens = await dex.methods.getTokens().call();
  const tokenContracts = tokens.reduce((acc, token) => ({
    ...acc,
    [web3.utils.hexToUtf8(token.ticker)]: new web3.eth.Contract(
      ERC20Abi,
      token.tokenAddress
    )
  }), {});
  return { dex, ...tokenContracts }
}

export { getWeb3, getContracts }