import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) return (
    <div className='flex items-center gap-2'>
      <span className='text-sm text-gray-600 font-mono'>
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </span>
      <button
        onClick={() => disconnect()}
        className='text-xs text-red-500 hover:underline'>
        Desconectar
      </button>
    </div>
  )

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className='bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700'>
      Conectar Wallet
    </button>
  )
}
