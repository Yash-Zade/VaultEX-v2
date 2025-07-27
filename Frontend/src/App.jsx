import { useEffect, useState } from "react";
import { ethers } from "ethers";

function App() {
  const [wallet, setWallet] = useState({ address: "", network: "" });

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();

    setWallet({
      address,
      network: `${network.name} (${network.chainId})`,
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-gray-800 p-4">
      <h1 className="text-3xl font-bold mb-6">🔐 VaultEX Frontend</h1>

      {wallet.address ? (
        <div className="bg-white p-6 rounded shadow-md text-center">
          <p className="mb-2">✅ Connected</p>
          <p><strong>Address:</strong> {wallet.address}</p>
          <p><strong>Network:</strong> {wallet.network}</p>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
}

export default App;
