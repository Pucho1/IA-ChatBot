'use client';
import useChat from "./useChat";

export function Chat() {

	const { input, messages, loading, handleInputChange, handleSubmit } = useChat();

	return (
			<div className="flex px-20 py-10 w-screen h-screen flex-col gap-4">

				{
					messages.map((msg, index) => {
						return (
							<div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} p-4 rounded-lg w-full`} key={index}>
								<p className={` p-2 rounded-lg ${msg.role === "user" ? "bg-gray-900" : ""}`}>{msg.content}</p>
							</div>
						)
					})
				}


				<form className="flex flex-col mt-auto px-20 gap-4" onSubmit={handleSubmit}>
					<label> Dime que necesitas saber</label>
					<input
						className="flex-1 border border-gray-300 rounded-full px-4 py-2"
						type="text"
						name="content"
						value={input}
						onChange={handleInputChange} 
					/>
				</form>
			</div>
	);

};

