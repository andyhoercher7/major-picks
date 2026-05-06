import React from 'react'

export default function Toast({ msg, visible }) {
  return (
    <div className={`toast ${visible ? 'show' : ''}`}>
      {msg}
    </div>
  )
}
